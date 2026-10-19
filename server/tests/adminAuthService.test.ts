import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { AdminAuthService } from "../src/services/adminAuthService.js";
import type { AdminUserRepository } from "../src/repositories/adminUserRepository.js";
import type { AdminSessionRepository } from "../src/repositories/adminSessionRepository.js";
import type { AdminLoginAttemptRepository } from "../src/repositories/adminLoginAttemptRepository.js";
import { InMemoryRateLimiter } from "../src/auth/rateLimiter.js";
import { hashPassword } from "../src/security/hash.js";

const config = {
  adminJwtSecret: "test-admin-jwt-secret-at-least-32-chars-long",
  adminAccessTokenTtlSeconds: 900,
  adminRefreshTokenTtlSeconds: 3600
} as unknown as AppConfig;

function buildLoginAttempts(): AdminLoginAttemptRepository {
  return {
    isBlocked: vi.fn().mockResolvedValue({ blocked: false, attemptCount: 0, retryAfterSeconds: 0 }),
    registerFailure: vi.fn().mockResolvedValue({ blocked: false, attemptCount: 1, retryAfterSeconds: 0 }),
    registerSuccess: vi.fn().mockResolvedValue(undefined)
  };
}

function buildSessions(): AdminSessionRepository {
  return {
    create: vi.fn().mockResolvedValue({}),
    findById: vi.fn(),
    touchActivity: vi.fn(),
    updateTokenHash: vi.fn(),
    revoke: vi.fn()
  };
}

describe("AdminAuthService.login -- mitigacao de enumeracao por tempo de resposta", () => {
  it("chama verifyPassword (paga o custo do scrypt) mesmo quando o e-mail nao existe", async () => {
    const adminUsers: AdminUserRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn()
    };
    const service = new AdminAuthService(config, adminUsers, buildSessions(), buildLoginAttempts(), new InMemoryRateLimiter());

    const start = performance.now();
    await expect(
      service.login({ email: "naoexiste@acessanet.com", password: "qualquer-coisa", ip: "1.2.3.4" })
    ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS" });
    const elapsed = performance.now() - start;

    // scrypt (N=16384) sempre demora pelo menos alguns ms -- uma resposta
    // "instantanea" (<3ms) indicaria que a comparacao foi pulada de novo.
    expect(elapsed).toBeGreaterThan(3);
  });

  it("login continua funcionando normalmente para credenciais validas", async () => {
    const passwordHash = await hashPassword("SenhaForte123");
    const adminUsers: AdminUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        id: "admin_1",
        email: "admin@acessanet.com",
        name: "Admin",
        passwordHash,
        role: "admin",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      findById: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn()
    };
    const service = new AdminAuthService(config, adminUsers, buildSessions(), buildLoginAttempts(), new InMemoryRateLimiter());

    const result = await service.login({ email: "admin@acessanet.com", password: "SenhaForte123", ip: "1.2.3.4" });

    expect(result.admin.email).toBe("admin@acessanet.com");
    expect(result.accessToken).toBeTruthy();
  });

  it("aceita identificador administrativo fora do formato de e-mail", async () => {
    const passwordHash = await hashPassword("SenhaForte123");
    const adminUsers: AdminUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        id: "admin_1",
        email: "acess@net@admin.com",
        name: "Admin",
        passwordHash,
        role: "admin",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      findById: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn()
    };
    const service = new AdminAuthService(config, adminUsers, buildSessions(), buildLoginAttempts(), new InMemoryRateLimiter());

    const result = await service.login({ email: "Acess@net@admin.com", password: "SenhaForte123", ip: "1.2.3.4" });

    expect(adminUsers.findByEmail).toHaveBeenCalledWith("Acess@net@admin.com");
    expect(result.admin.email).toBe("acess@net@admin.com");
    expect(result.accessToken).toBeTruthy();
  });

  it("rejeita senha errada para admin existente", async () => {
    const passwordHash = await hashPassword("SenhaForte123");
    const adminUsers: AdminUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        id: "admin_1",
        email: "admin@acessanet.com",
        name: "Admin",
        passwordHash,
        role: "admin",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      findById: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn()
    };
    const service = new AdminAuthService(config, adminUsers, buildSessions(), buildLoginAttempts(), new InMemoryRateLimiter());

    await expect(
      service.login({ email: "admin@acessanet.com", password: "senha-errada", ip: "1.2.3.4" })
    ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS" });
  });

  it("rejeita admin inativo mesmo com a senha certa", async () => {
    const passwordHash = await hashPassword("SenhaForte123");
    const adminUsers: AdminUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        id: "admin_1",
        email: "admin@acessanet.com",
        name: "Admin",
        passwordHash,
        role: "admin",
        active: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      findById: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn()
    };
    const service = new AdminAuthService(config, adminUsers, buildSessions(), buildLoginAttempts(), new InMemoryRateLimiter());

    await expect(
      service.login({ email: "admin@acessanet.com", password: "SenhaForte123", ip: "1.2.3.4" })
    ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS" });
  });
});
