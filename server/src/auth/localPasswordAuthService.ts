import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { hashPassword, verifyPassword, hmacSha256, randomId, sha256 } from "../security/hash.js";
import { isValidCpf, maskCpf, normalizeCpf } from "./cpf.js";
import { validateNewPassword } from "./passwordPolicy.js";
import { TokenService } from "./tokenService.js";
import type { InMemoryRateLimiter } from "./rateLimiter.js";
import type { CpfResolverResult } from "./cpfResolver.js";
import type { AuthProfileRepository } from "../repositories/authProfileRepository.js";
import type { SessionRepository } from "../repositories/sessionRepository.js";
import type { LoginAttemptRepository, LoginAttemptRule } from "../repositories/loginAttemptRepository.js";
import type { AuditLogRepository, AuthFailureReason } from "../repositories/auditLogRepository.js";

const CHECK_RULE: LoginAttemptRule = { maxAttempts: 15, windowMs: 10 * 60 * 1000, softDelayStartAt: 8 };
const LOGIN_RULE: LoginAttemptRule = { maxAttempts: 5, windowMs: 10 * 60 * 1000, softDelayStartAt: 3 };
const SETUP_RULE: LoginAttemptRule = { maxAttempts: 5, windowMs: 15 * 60 * 1000, softDelayStartAt: 3 };

const GENERIC_INVALID_CREDENTIALS_MESSAGE = "CPF ou senha incorretos.";
const GENERIC_UNAVAILABLE_MESSAGE = "Não foi possível acessar sua conta agora. Tente novamente em alguns instantes.";
const GENERIC_RATE_LIMIT_MESSAGE = "Muitas tentativas foram realizadas. Aguarde alguns minutos e tente novamente.";

/** Senha inicial generica usada so para bloquear reescolha (nao existe "senha inicial do SGP" aqui, ao contrario do AcessaNet app). */
const GENERIC_INITIAL_PASSWORD = "acessanet";

export interface LocalAuthResult {
  accessToken: string;
  refreshToken: string;
  customer: {
    id: string;
    name: string;
    maskedCpf: string;
    maskedPhone?: string;
  };
  contracts: Array<{
    id: string;
    addressLine: string;
    city: string;
    state: string;
    planName: string;
    status: string;
  }>;
}

/**
 * Autenticacao por CPF + senha PROPRIA deste backend (nao existe endpoint
 * SGP de login por senha confirmado -- ver docs/SGP_INTEGRATION.md no repo
 * AcessaNet app). A senha nunca e persistida em texto puro (scrypt via
 * security/hash.ts) e o CPF nunca e persistido em texto puro (so o hash
 * HMAC). "checkAccess"/"setupPassword" sempre revalidam o CPF contra o SGP,
 * entao so quem realmente e cliente Acessanet consegue criar uma senha.
 */
export class LocalPasswordAuthService {
  readonly tokens: TokenService;

  constructor(
    private readonly config: AppConfig,
    private readonly cpfResolver: { resolve: (cpf: string) => Promise<CpfResolverResult | null> },
    private readonly authProfiles: AuthProfileRepository,
    private readonly sessions: SessionRepository,
    private readonly loginAttempts: LoginAttemptRepository,
    private readonly auditLog: AuditLogRepository,
    private readonly rateLimiter: InMemoryRateLimiter
  ) {
    this.tokens = new TokenService(config);
  }

  private cpfHash(digits: string) {
    return hmacSha256(digits, this.config.cpfHashSecret);
  }

  private ipHash(ip: string) {
    return sha256(ip || "unknown");
  }

  /** Passo 1 do login: informa se este CPF ja tem senha criada, sem devolver nenhuma sessao. */
  async checkAccess(input: { cpf: string; ip: string }): Promise<{ hasPassword: boolean }> {
    const digits = normalizeCpf(input.cpf);

    this.rateLimiter.consume(`local_check:ip:${input.ip}`, { limit: 30, windowMs: 60_000, cooldownMs: 60_000 });

    if (!isValidCpf(digits)) {
      throw new AppError(400, "CPF_INVALID", "Informe um CPF válido.");
    }

    const cpfHash = this.cpfHash(digits);
    const ipHash = this.ipHash(input.ip);

    const blocked = await this.loginAttempts.isBlocked(cpfHash, ipHash);
    if (blocked.blocked) {
      throw new AppError(429, "RATE_LIMITED", GENERIC_RATE_LIMIT_MESSAGE, { retryAfterSeconds: blocked.retryAfterSeconds });
    }

    let resolved: CpfResolverResult | null;
    try {
      resolved = await this.cpfResolver.resolve(digits);
    } catch {
      await this.loginAttempts.registerFailure(cpfHash, ipHash, CHECK_RULE);
      throw new AppError(502, "SGP_UNAVAILABLE", GENERIC_UNAVAILABLE_MESSAGE);
    }

    if (!resolved) {
      await this.loginAttempts.registerFailure(cpfHash, ipHash, CHECK_RULE);
      throw new AppError(404, "CUSTOMER_NOT_FOUND", "Não encontramos um cliente com os dados informados.");
    }

    const profile = await this.authProfiles.findByCpfHash(cpfHash);
    return { hasPassword: Boolean(profile?.passwordHash) };
  }

  /** Primeiro acesso: cria a senha (so quando ainda nao existe uma) e ja retorna uma sessao completa. */
  async setupPassword(input: {
    cpf: string;
    newPassword: string;
    confirmPassword?: string | undefined;
    ip: string;
    userAgent?: string | undefined;
  }): Promise<LocalAuthResult> {
    const digits = normalizeCpf(input.cpf);
    const cpfHash = this.cpfHash(digits);
    const ipHash = this.ipHash(input.ip);
    const maskedCpf = digits.length === 11 ? maskCpf(digits) : "***.***.***-**";

    this.rateLimiter.consume(`local_setup:ip:${input.ip}`, { limit: 10, windowMs: 60_000, cooldownMs: 60_000 });

    const blocked = await this.loginAttempts.isBlocked(cpfHash, ipHash);
    if (blocked.blocked) {
      throw new AppError(429, "RATE_LIMITED", GENERIC_RATE_LIMIT_MESSAGE, { retryAfterSeconds: blocked.retryAfterSeconds });
    }

    if (!isValidCpf(digits)) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, SETUP_RULE, "CPF_INVALID");
      throw new AppError(400, "CPF_INVALID", "Informe um CPF válido.");
    }

    if (input.confirmPassword !== undefined && input.confirmPassword !== input.newPassword) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, SETUP_RULE, "PASSWORD_MISMATCH");
      throw new AppError(400, "VALIDATION_ERROR", "As senhas não coincidem.");
    }

    try {
      validateNewPassword(input.newPassword, { initialPassword: GENERIC_INITIAL_PASSWORD });
    } catch (error) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, SETUP_RULE, "PASSWORD_POLICY_REJECTED");
      throw error;
    }

    let resolved: CpfResolverResult | null;
    try {
      resolved = await this.cpfResolver.resolve(digits);
    } catch {
      throw new AppError(502, "SGP_UNAVAILABLE", GENERIC_UNAVAILABLE_MESSAGE);
    }

    if (!resolved) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, SETUP_RULE, "CUSTOMER_NOT_FOUND");
      throw new AppError(404, "CUSTOMER_NOT_FOUND", "Não encontramos um cliente com os dados informados.");
    }

    const profile = await this.authProfiles.getOrCreate({
      cpfHash,
      cpfLastDigits: digits.slice(-4),
      sgpCustomerId: resolved.customer.id
    });

    if (profile.passwordHash) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, SETUP_RULE, "INVALID_CREDENTIALS");
      throw new AppError(409, "PASSWORD_ALREADY_SET", "Este CPF já tem senha cadastrada. Faça login normalmente.");
    }

    const passwordHash = await hashPassword(input.newPassword);
    const now = new Date();
    await this.authProfiles.setPasswordHash(cpfHash, passwordHash, now);
    await this.loginAttempts.registerSuccess(cpfHash, ipHash);
    await this.authProfiles.recordSuccessfulLogin(cpfHash, ipHash, now);

    await this.auditLog.record({
      eventType: "FIRST_ACCESS_PASSWORD_CHANGE_SUCCESS",
      customerId: resolved.customer.id,
      cpfHash,
      cpfMasked: maskedCpf,
      ipHash,
      userAgent: input.userAgent,
      status: "SUCCESS"
    });

    return this.createSession(resolved, cpfHash, ipHash, input.userAgent);
  }

  /** Login normal: CPF + senha propria ja criada. */
  async login(input: { cpf: string; password: string; ip: string; userAgent?: string | undefined }): Promise<LocalAuthResult> {
    const digits = normalizeCpf(input.cpf);
    const cpfHash = this.cpfHash(digits);
    const ipHash = this.ipHash(input.ip);
    const maskedCpf = digits.length === 11 ? maskCpf(digits) : "***.***.***-**";

    this.rateLimiter.consume(`local_login:ip:${input.ip}`, { limit: 30, windowMs: 60_000, cooldownMs: 60_000 });

    const blocked = await this.loginAttempts.isBlocked(cpfHash, ipHash);
    if (blocked.blocked) {
      await this.auditLog.record({
        eventType: "RATE_LIMIT_TRIGGERED",
        cpfHash,
        cpfMasked: maskedCpf,
        ipHash,
        userAgent: input.userAgent,
        status: "FAILED",
        failureReason: "RATE_LIMITED"
      });
      throw new AppError(429, "RATE_LIMITED", GENERIC_RATE_LIMIT_MESSAGE, { retryAfterSeconds: blocked.retryAfterSeconds });
    }

    if (!isValidCpf(digits)) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, LOGIN_RULE, "CPF_INVALID");
      throw new AppError(401, "INVALID_CREDENTIALS", GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    const profile = await this.authProfiles.findByCpfHash(cpfHash);

    if (!profile?.passwordHash) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, LOGIN_RULE, "INVALID_CREDENTIALS");
      throw new AppError(401, "INVALID_CREDENTIALS", GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordValid = await verifyPassword(input.password, profile.passwordHash);
    if (!passwordValid) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, LOGIN_RULE, "INVALID_CREDENTIALS");
      throw new AppError(401, "INVALID_CREDENTIALS", GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    let resolved: CpfResolverResult | null;
    try {
      resolved = await this.cpfResolver.resolve(digits);
    } catch {
      throw new AppError(502, "SGP_UNAVAILABLE", GENERIC_UNAVAILABLE_MESSAGE);
    }

    if (!resolved) {
      await this.registerFailure(cpfHash, ipHash, maskedCpf, input.userAgent, LOGIN_RULE, "CUSTOMER_NOT_FOUND");
      throw new AppError(404, "CUSTOMER_NOT_FOUND", "Não encontramos um cliente com os dados informados.");
    }

    await this.loginAttempts.registerSuccess(cpfHash, ipHash);
    await this.authProfiles.recordSuccessfulLogin(cpfHash, ipHash, new Date());

    return this.createSession(resolved, cpfHash, ipHash, input.userAgent);
  }

  /** Troca de senha autenticada (Perfil > Seguranca). Identidade vem da sessao (cpfHash/customerId), nunca de um id enviado pelo cliente. */
  async changePassword(input: {
    customerId: string;
    cpfHash: string;
    sessionId: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    ip: string;
    userAgent?: string | undefined;
  }): Promise<void> {
    const ipHash = this.ipHash(input.ip);

    this.rateLimiter.consume(`local_change_password:customer:${input.customerId}`, {
      limit: 10,
      windowMs: 60_000,
      cooldownMs: 60_000
    });

    if (input.newPassword !== input.confirmPassword) {
      throw new AppError(400, "VALIDATION_ERROR", "As senhas não coincidem.");
    }

    const profile = await this.authProfiles.findByCpfHash(input.cpfHash);
    if (!profile?.passwordHash) {
      throw new AppError(401, "INVALID_CREDENTIALS", GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    const currentValid = await verifyPassword(input.currentPassword, profile.passwordHash);
    if (!currentValid) {
      await this.auditLog.record({
        eventType: "PASSWORD_CHANGED",
        customerId: input.customerId,
        cpfHash: input.cpfHash,
        ipHash,
        userAgent: input.userAgent,
        status: "FAILED",
        failureReason: "INVALID_CREDENTIALS"
      });
      throw new AppError(401, "INVALID_CREDENTIALS", "Senha atual incorreta.");
    }

    validateNewPassword(input.newPassword, {
      initialPassword: GENERIC_INITIAL_PASSWORD,
      currentPassword: input.currentPassword
    });

    const passwordHash = await hashPassword(input.newPassword);
    const now = new Date();
    await this.authProfiles.setPasswordHash(input.cpfHash, passwordHash, now);
    await this.sessions.revokeAllForCpfHash(input.cpfHash, now, input.sessionId);

    await this.auditLog.record({
      eventType: "PASSWORD_CHANGED",
      customerId: input.customerId,
      cpfHash: input.cpfHash,
      ipHash,
      userAgent: input.userAgent,
      status: "SUCCESS"
    });
  }

  async logout(customerId: string, sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (session && session.customerId === customerId) {
      await this.sessions.revoke(sessionId, new Date());
      await this.auditLog.record({ eventType: "SESSION_REVOKED", customerId, status: "SUCCESS" });
    }
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.tokens.verifyRefreshToken(refreshToken);
    const session = await this.sessions.findById(payload.sessionId);

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.customerId !== payload.sub ||
      session.sessionTokenHash !== sha256(payload.tokenId)
    ) {
      throw new AppError(401, "INVALID_REFRESH", "Sessao invalida.");
    }

    const nextRefresh = this.tokens.issueRefreshToken(session.customerId, session.id);
    await this.sessions.updateTokenHash(session.id, nextRefresh.tokenHash);

    return {
      accessToken: this.tokens.issueAccessToken(session.customerId, session.id),
      refreshToken: nextRefresh.token
    };
  }

  private async createSession(
    resolved: CpfResolverResult,
    cpfHash: string,
    ipHash: string,
    userAgent: string | undefined
  ): Promise<LocalAuthResult> {
    const sessionId = randomId("authsess");
    const refresh = this.tokens.issueRefreshToken(resolved.customer.id, sessionId);
    const accessToken = this.tokens.issueAccessToken(resolved.customer.id, sessionId);

    await this.sessions.create({
      id: sessionId,
      sessionTokenHash: refresh.tokenHash,
      customerId: resolved.customer.id,
      cpfHash,
      expiresAt: new Date(Date.now() + this.config.refreshTokenTtlSeconds * 1000),
      ipHash,
      userAgent
    });

    await this.auditLog.record({
      eventType: "SESSION_CREATED",
      customerId: resolved.customer.id,
      cpfHash,
      ipHash,
      userAgent,
      status: "SUCCESS"
    });

    await this.auditLog.record({
      eventType: "LOGIN_SUCCESS",
      customerId: resolved.customer.id,
      cpfHash,
      ipHash,
      userAgent,
      status: "SUCCESS"
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      customer: {
        id: resolved.customer.id,
        name: resolved.customer.name,
        maskedCpf: resolved.customer.maskedCpf,
        maskedPhone: resolved.customer.maskedPhone
      },
      contracts: resolved.contracts.map((contract) => ({
        id: String(contract.id ?? ""),
        addressLine: String(contract.addressLine ?? ""),
        city: String(contract.city ?? ""),
        state: String(contract.state ?? ""),
        planName: String(contract.planName ?? "Plano Acessanet"),
        status: String(contract.status ?? "UNKNOWN")
      }))
    };
  }

  private async registerFailure(
    cpfHash: string,
    ipHash: string,
    maskedCpf: string,
    userAgent: string | undefined,
    rule: LoginAttemptRule,
    reason: AuthFailureReason
  ) {
    await this.loginAttempts.registerFailure(cpfHash, ipHash, rule);
    await this.auditLog.record({
      eventType: "LOGIN_FAILED",
      cpfHash,
      cpfMasked: maskedCpf,
      ipHash,
      userAgent,
      status: "FAILED",
      failureReason: reason
    });
  }
}
