import { describe, expect, it, vi, beforeEach } from "vitest";
import { PasswordResetService } from "../src/auth/passwordResetService.js";
import { LocalPasswordAuthService } from "../src/auth/localPasswordAuthService.js";
import { InMemoryRateLimiter } from "../src/auth/rateLimiter.js";
import { loadConfig } from "../src/config.js";
import type { AuthProfileRecord, AuthProfileRepository } from "../src/repositories/authProfileRepository.js";
import type { AuthSessionRecord, CreateAuthSessionInput, SessionRepository } from "../src/repositories/sessionRepository.js";
import type { PasswordResetRepository, PasswordResetRequestRecord } from "../src/repositories/passwordResetRepository.js";
import type { AuditLogRepository } from "../src/repositories/auditLogRepository.js";
import type { LoginAttemptRepository, LoginAttemptRule } from "../src/repositories/loginAttemptRepository.js";
import type { Mailer } from "../src/email/mailer.js";
import type { CpfResolverResult } from "../src/auth/cpfResolver.js";
import { hmacSha256 } from "../src/security/hash.js";
import { AppError } from "../src/errors.js";

const VALID_CPF = "52998224725"; // digito verificador valido
const CONFIG = loadConfig({ env: "test" });

function fakeAuthProfiles(): AuthProfileRepository {
  const rows = new Map<string, AuthProfileRecord>();
  return {
    async findByCpfHash(cpfHash) {
      return rows.get(cpfHash) ?? null;
    },
    async getOrCreate(input) {
      const existing = rows.get(input.cpfHash);
      if (existing) return existing;
      const created: AuthProfileRecord = {
        cpfHash: input.cpfHash,
        sgpCustomerId: input.sgpCustomerId ?? null,
        cpfLastDigits: input.cpfLastDigits,
        firstAccessCompleted: false,
        passwordChangedAt: null,
        lastLoginAt: null,
        lastLoginIpHash: null,
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      rows.set(input.cpfHash, created);
      return created;
    },
    async markFirstAccessCompleted() {},
    async markPasswordChanged() {},
    async recordSuccessfulLogin() {},
    async setPasswordHash(cpfHash, passwordHash, when) {
      const row = rows.get(cpfHash);
      if (row) {
        row.passwordHash = passwordHash;
        row.passwordChangedAt = when;
      }
    }
  };
}

function fakeSessions(): SessionRepository {
  const rows = new Map<string, AuthSessionRecord>();
  return {
    async create(input: CreateAuthSessionInput) {
      const record: AuthSessionRecord = {
        id: input.id,
        sessionTokenHash: input.sessionTokenHash,
        customerId: input.customerId,
        cpfHash: input.cpfHash,
        createdAt: new Date(),
        expiresAt: input.expiresAt,
        lastActivityAt: new Date(),
        revokedAt: null,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null
      };
      rows.set(record.id, record);
      return record;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async touchActivity() {},
    async updateTokenHash() {},
    async revoke(id, when) {
      const row = rows.get(id);
      if (row) row.revokedAt = when;
    },
    async revokeAllForCpfHash(cpfHash, when, exceptId) {
      let count = 0;
      for (const row of rows.values()) {
        if (row.cpfHash === cpfHash && !row.revokedAt && row.id !== exceptId) {
          row.revokedAt = when;
          count += 1;
        }
      }
      return count;
    }
  };
}

function fakePasswordResets(): PasswordResetRepository {
  const rows = new Map<string, PasswordResetRequestRecord>();
  return {
    async createRequest(input) {
      for (const row of rows.values()) {
        if (row.cpfHash === input.cpfHash && !row.otpUsedAt) {
          row.otpUsedAt = new Date();
        }
      }
      const record: PasswordResetRequestRecord = {
        id: input.id,
        cpfHash: input.cpfHash,
        otpHash: input.otpHash,
        otpExpiresAt: input.otpExpiresAt,
        otpAttempts: 0,
        otpUsedAt: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        resetTokenUsedAt: null,
        ipHash: input.ipHash ?? null,
        createdAt: new Date()
      };
      rows.set(record.id, record);
      return record;
    },
    async findLatestByCpfHash(cpfHash) {
      const matches = [...rows.values()].filter((row) => row.cpfHash === cpfHash);
      matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return matches[0] ?? null;
    },
    async findActiveByCpfHash(cpfHash) {
      const matches = [...rows.values()].filter((row) => row.cpfHash === cpfHash && !row.otpUsedAt);
      matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return matches[0] ?? null;
    },
    async incrementOtpAttempts(id) {
      const row = rows.get(id);
      if (!row) return 0;
      row.otpAttempts += 1;
      return row.otpAttempts;
    },
    async markOtpUsed(id, when) {
      const row = rows.get(id);
      if (row) row.otpUsedAt = when;
    },
    async setResetToken(id, resetTokenHash, resetTokenExpiresAt) {
      const row = rows.get(id);
      if (row) {
        row.resetTokenHash = resetTokenHash;
        row.resetTokenExpiresAt = resetTokenExpiresAt;
      }
    },
    async findByResetTokenHash(resetTokenHash) {
      return [...rows.values()].find((row) => row.resetTokenHash === resetTokenHash) ?? null;
    },
    async markResetTokenUsed(id, when) {
      const row = rows.get(id);
      if (row) row.resetTokenUsedAt = when;
    }
  };
}

function getSentCode(mailer: Mailer): string {
  const calls = (mailer.sendOtpEmail as ReturnType<typeof vi.fn>).mock.calls;
  const call = calls[0]?.[0] as { code?: string } | undefined;
  if (!call?.code) {
    throw new Error("sendOtpEmail nao foi chamado");
  }
  return call.code;
}

function fakeAuditLog(): AuditLogRepository {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

function fakeLoginAttempts(): LoginAttemptRepository {
  return {
    async isBlocked() {
      return { blocked: false, attemptCount: 0, retryAfterSeconds: 0 };
    },
    async registerFailure() {
      return { blocked: false, attemptCount: 1, retryAfterSeconds: 0 };
    },
    async registerSuccess() {}
  };
}

function resolvedCustomer(overrides: Partial<CpfResolverResult["customer"]> = {}): CpfResolverResult {
  return {
    customer: {
      id: "customer_1",
      name: "Lucas Teste",
      cpfHash: hmacSha256(VALID_CPF, CONFIG.cpfHashSecret),
      maskedCpf: "***.***.***-25",
      phone: "11987654321",
      maskedPhone: "(11) *****-4321",
      email: "lucas@example.com",
      maskedEmail: "lu***@example.com",
      ...overrides
    },
    contracts: []
  };
}

describe("PasswordResetService", () => {
  let mailer: Mailer;
  let passwordResets: PasswordResetRepository;
  let authProfiles: AuthProfileRepository;
  let sessions: SessionRepository;

  function buildService(resolve: (cpf: string) => Promise<CpfResolverResult | null>) {
    passwordResets = fakePasswordResets();
    authProfiles = fakeAuthProfiles();
    sessions = fakeSessions();
    mailer = { sendOtpEmail: vi.fn().mockResolvedValue(undefined), verifyConnection: vi.fn() };
    return new PasswordResetService(
      CONFIG,
      { resolve },
      authProfiles,
      sessions,
      passwordResets,
      mailer,
      fakeAuditLog(),
      new InMemoryRateLimiter()
    );
  }

  it("devolve mensagem generica e nao envia e-mail quando o CPF nao resolve no SGP", async () => {
    const service = buildService(async () => null);
    const result = await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });

    expect(result.message).toMatch(/estiverem cadastrados/i);
    expect(mailer.sendOtpEmail).not.toHaveBeenCalled();
  });

  it("devolve a MESMA mensagem generica quando o cliente existe mas nao tem e-mail cadastrado", async () => {
    const service = buildService(async () => resolvedCustomer({ email: "", maskedEmail: "" }));
    const result = await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });

    expect(result.message).toMatch(/estiverem cadastrados/i);
    expect(mailer.sendOtpEmail).not.toHaveBeenCalled();
  });

  it("envia o codigo por e-mail quando o cliente existe e tem e-mail", async () => {
    const service = buildService(async () => resolvedCustomer());
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });

    expect(mailer.sendOtpEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "lucas@example.com", name: "Lucas Teste", code: expect.stringMatching(/^\d{6}$/) })
    );
  });

  it("nao reenvia um segundo codigo antes do cooldown de 60s", async () => {
    const service = buildService(async () => resolvedCustomer());
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });

    expect(mailer.sendOtpEmail).toHaveBeenCalledTimes(1);
  });

  it("verifica o codigo correto e devolve um reset_token", async () => {
    const service = buildService(async () => resolvedCustomer());
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });

    const sentCode = getSentCode(mailer);
    const { resetToken } = await service.verifyCode({ cpf: VALID_CPF, code: sentCode, ip: "1.1.1.1" });

    expect(resetToken).toBeTruthy();
    expect(resetToken.length).toBeGreaterThan(20);
  });

  it("rejeita codigo errado e conta a tentativa", async () => {
    const service = buildService(async () => resolvedCustomer());
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });

    await expect(service.verifyCode({ cpf: VALID_CPF, code: "000000", ip: "1.1.1.1" })).rejects.toMatchObject({
      code: "CODE_INVALID"
    });

    const cpfHash = hmacSha256(VALID_CPF, CONFIG.cpfHashSecret);
    const active = await passwordResets.findActiveByCpfHash(cpfHash);
    expect(active?.otpAttempts).toBe(1);
  });

  it("bloqueia apos 5 tentativas erradas, mesmo que o codigo certo venha depois", async () => {
    const service = buildService(async () => resolvedCustomer());
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });
    const sentCode = getSentCode(mailer);

    for (let i = 0; i < 5; i += 1) {
      await expect(service.verifyCode({ cpf: VALID_CPF, code: "111111", ip: "1.1.1.1" })).rejects.toMatchObject({
        code: expect.stringMatching(/CODE_INVALID|TOO_MANY_ATTEMPTS/)
      });
    }

    await expect(service.verifyCode({ cpf: VALID_CPF, code: sentCode, ip: "1.1.1.1" })).rejects.toMatchObject({
      code: "CODE_INVALID"
    });
  });

  it("rejeita codigo expirado", async () => {
    const service = buildService(async () => resolvedCustomer());
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });
    const sentCode = getSentCode(mailer);

    const cpfHash = hmacSha256(VALID_CPF, CONFIG.cpfHashSecret);
    const active = await passwordResets.findActiveByCpfHash(cpfHash);
    active!.otpExpiresAt = new Date(Date.now() - 1000);

    await expect(service.verifyCode({ cpf: VALID_CPF, code: sentCode, ip: "1.1.1.1" })).rejects.toMatchObject({
      code: "CODE_EXPIRED"
    });
  });

  it("completa o reset de senha com reset_token valido e invalida o token depois de usado", async () => {
    const service = buildService(async () => resolvedCustomer());
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });
    const sentCode = getSentCode(mailer);
    const { resetToken } = await service.verifyCode({ cpf: VALID_CPF, code: sentCode, ip: "1.1.1.1" });

    await service.resetPassword({ resetToken, newPassword: "novaSenha123", confirmPassword: "novaSenha123", ip: "1.1.1.1" });

    const cpfHash = hmacSha256(VALID_CPF, CONFIG.cpfHashSecret);
    const profile = await authProfiles.findByCpfHash(cpfHash);
    expect(profile?.passwordHash).toBeTruthy();

    await expect(
      service.resetPassword({ resetToken, newPassword: "outraSenha123", confirmPassword: "outraSenha123", ip: "1.1.1.1" })
    ).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
  });

  it("rejeita reset_token expirado", async () => {
    const service = buildService(async () => resolvedCustomer());
    await service.requestReset({ cpf: VALID_CPF, ip: "1.1.1.1" });
    const sentCode = getSentCode(mailer);
    const { resetToken } = await service.verifyCode({ cpf: VALID_CPF, code: sentCode, ip: "1.1.1.1" });

    const cpfHash = hmacSha256(VALID_CPF, CONFIG.cpfHashSecret);
    const request = await passwordResets.findLatestByCpfHash(cpfHash);
    request!.resetTokenExpiresAt = new Date(Date.now() - 1000);

    await expect(
      service.resetPassword({ resetToken, newPassword: "novaSenha123", confirmPassword: "novaSenha123", ip: "1.1.1.1" })
    ).rejects.toMatchObject({ code: "RESET_TOKEN_EXPIRED" });
  });

  it("rejeita quando nova senha e confirmacao nao coincidem", async () => {
    const service = buildService(async () => resolvedCustomer());
    await expect(
      service.resetPassword({ resetToken: "a".repeat(32), newPassword: "senha1234", confirmPassword: "senhaDiferente", ip: "1.1.1.1" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("LocalPasswordAuthService.changePassword", () => {
  it("troca a senha com sucesso quando a senha atual esta correta", async () => {
    const authProfiles = fakeAuthProfiles();
    const sessions = fakeSessions();
    const auditLog = fakeAuditLog();
    const service = new LocalPasswordAuthService(
      CONFIG,
      {
        resolve: async () => resolvedCustomer()
      },
      authProfiles,
      sessions,
      fakeLoginAttempts(),
      auditLog,
      new InMemoryRateLimiter()
    );

    const cpfHash = hmacSha256(VALID_CPF, CONFIG.cpfHashSecret);
    const setup = await service.setupPassword({ cpf: VALID_CPF, newPassword: "senhaAntiga1", ip: "1.1.1.1" });

    await service.changePassword({
      customerId: setup.customer.id,
      cpfHash,
      sessionId: "irrelevant_session",
      currentPassword: "senhaAntiga1",
      newPassword: "senhaNova12",
      confirmPassword: "senhaNova12",
      ip: "1.1.1.1"
    });

    const login = await service.login({ cpf: VALID_CPF, password: "senhaNova12", ip: "1.1.1.1" });
    expect(login.accessToken).toBeTruthy();

    await expect(service.login({ cpf: VALID_CPF, password: "senhaAntiga1", ip: "1.1.1.1" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS"
    });
  });

  it("rejeita quando a senha atual informada esta incorreta", async () => {
    const authProfiles = fakeAuthProfiles();
    const sessions = fakeSessions();
    const service = new LocalPasswordAuthService(
      CONFIG,
      { resolve: async () => resolvedCustomer() },
      authProfiles,
      sessions,
      fakeLoginAttempts(),
      fakeAuditLog(),
      new InMemoryRateLimiter()
    );

    const cpfHash = hmacSha256(VALID_CPF, CONFIG.cpfHashSecret);
    const setup = await service.setupPassword({ cpf: VALID_CPF, newPassword: "senhaAntiga1", ip: "1.1.1.1" });

    await expect(
      service.changePassword({
        customerId: setup.customer.id,
        cpfHash,
        sessionId: "irrelevant_session",
        currentPassword: "senhaErrada1",
        newPassword: "senhaNova12",
        confirmPassword: "senhaNova12",
        ip: "1.1.1.1"
      })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});
