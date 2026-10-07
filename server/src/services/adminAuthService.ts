import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { hashPassword, verifyPassword, randomId, sha256 } from "../security/hash.js";
import { AdminTokenService } from "../auth/adminTokenService.js";
import type { InMemoryRateLimiter } from "../auth/rateLimiter.js";
import type { AdminUserRepository } from "../repositories/adminUserRepository.js";
import type { AdminSessionRepository } from "../repositories/adminSessionRepository.js";
import type { AdminLoginAttemptRepository, AdminLoginAttemptRule } from "../repositories/adminLoginAttemptRepository.js";

/** Mais estrito que LOGIN_RULE do cliente (localPasswordAuthService.ts): conta admin comprometida tem raio de impacto maior. */
const ADMIN_LOGIN_RULE: AdminLoginAttemptRule = { maxAttempts: 5, windowMs: 15 * 60 * 1000, softDelayStartAt: 2 };

const GENERIC_INVALID_CREDENTIALS_MESSAGE = "Usuario ou senha incorretos.";
const GENERIC_RATE_LIMIT_MESSAGE = "Muitas tentativas foram realizadas. Aguarde alguns minutos e tente novamente.";

export interface AdminAuthResult {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

/**
 * Login administrativo autocontido (ver plano "Avisos da Central"): nao
 * existe nenhuma autenticacao admin/staff preexistente neste backend para
 * reaproveitar, entao este servico e independente do LocalPasswordAuthService
 * (login de cliente) -- secret de token, tabela de sessao e tabela de
 * tentativas de login proprios, nunca compartilhados.
 */
export class AdminAuthService {
  readonly tokens: AdminTokenService;
  /**
   * Hash scrypt "de mentira", gerado uma vez e reaproveitado -- comparado
   * contra a senha informada quando o e-mail nao corresponde a nenhum admin
   * ativo, so pra pagar o MESMO custo de CPU que uma comparacao real
   * pagaria. Sem isso, "e-mail nao existe" responde quase instantaneo
   * enquanto "e-mail existe, senha errada" espera o scrypt -- diferenca de
   * tempo mensuravel que revela, por tentativa e erro, quais e-mails tem
   * conta admin (CWE-208). Nunca comparado com sucesso de verdade (a senha
   * informada por um atacante nunca bate com este valor aleatorio fixo).
   */
  private dummyPasswordHash: Promise<string> | undefined;

  constructor(
    private readonly config: AppConfig,
    private readonly adminUsers: AdminUserRepository,
    private readonly sessions: AdminSessionRepository,
    private readonly loginAttempts: AdminLoginAttemptRepository,
    private readonly rateLimiter: InMemoryRateLimiter
  ) {
    this.tokens = new AdminTokenService(config);
  }

  private ipHash(ip: string) {
    return sha256(ip || "unknown");
  }

  private emailHash(email: string) {
    return sha256(email.toLowerCase().trim());
  }

  private getDummyPasswordHash(): Promise<string> {
    if (!this.dummyPasswordHash) {
      this.dummyPasswordHash = hashPassword(randomId("admin-auth-dummy"));
    }
    return this.dummyPasswordHash;
  }

  async login(input: { email: string; password: string; ip: string; userAgent?: string | undefined }): Promise<AdminAuthResult> {
    const emailHash = this.emailHash(input.email);
    const ipHash = this.ipHash(input.ip);

    this.rateLimiter.consume(`admin_login:ip:${input.ip}`, { limit: 10, windowMs: 60_000, cooldownMs: 60_000 });

    const blocked = await this.loginAttempts.isBlocked(emailHash, ipHash);
    if (blocked.blocked) {
      throw new AppError(429, "RATE_LIMITED", GENERIC_RATE_LIMIT_MESSAGE, { retryAfterSeconds: blocked.retryAfterSeconds });
    }

    const found = await this.adminUsers.findByEmail(input.email);
    const admin = found?.active ? found : null;

    // Sempre roda o scrypt, exista ou nao o admin -- ver comentario de dummyPasswordHash.
    const passwordHash = admin?.passwordHash ?? (await this.getDummyPasswordHash());
    const passwordValid = await verifyPassword(input.password, passwordHash);

    if (!admin || !passwordValid) {
      await this.loginAttempts.registerFailure(emailHash, ipHash, ADMIN_LOGIN_RULE);
      throw new AppError(401, "INVALID_CREDENTIALS", GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    await this.loginAttempts.registerSuccess(emailHash, ipHash);

    const sessionId = randomId("adminsess");
    const refresh = this.tokens.issueRefreshToken(admin.id, sessionId);
    const accessToken = this.tokens.issueAccessToken(admin.id, sessionId, admin.role);

    await this.sessions.create({
      id: sessionId,
      sessionTokenHash: refresh.tokenHash,
      adminUserId: admin.id,
      expiresAt: new Date(Date.now() + this.config.adminRefreshTokenTtlSeconds * 1000),
      ipHash,
      userAgent: input.userAgent
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.tokens.verifyRefreshToken(refreshToken);
    const session = await this.sessions.findById(payload.sessionId);

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.adminUserId !== payload.sub ||
      session.sessionTokenHash !== sha256(payload.tokenId)
    ) {
      throw new AppError(401, "INVALID_REFRESH", "Sessao administrativa invalida.");
    }

    const admin = await this.adminUsers.findById(session.adminUserId);
    if (!admin || !admin.active) {
      throw new AppError(401, "INVALID_REFRESH", "Sessao administrativa invalida.");
    }

    const nextRefresh = this.tokens.issueRefreshToken(admin.id, session.id);
    await this.sessions.updateTokenHash(session.id, nextRefresh.tokenHash);

    return {
      accessToken: this.tokens.issueAccessToken(admin.id, session.id, admin.role),
      refreshToken: nextRefresh.token
    };
  }

  async logout(adminUserId: string, sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (session && session.adminUserId === adminUserId) {
      await this.sessions.revoke(sessionId, new Date());
    }
  }
}
