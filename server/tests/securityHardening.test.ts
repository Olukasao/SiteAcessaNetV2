import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { loadConfig } from "../src/config.js";
import { buildApp } from "../src/app.js";
import { createContainer } from "../src/container.js";
import { roleCanReachAdminPath } from "../src/auth/adminPermissions.js";
import { InMemoryRateLimiter } from "../src/auth/rateLimiter.js";

afterEach(() => vi.unstubAllEnvs());

describe("segredo do admin", () => {
  it("sem ADMIN_JWT_SECRET deriva do JWT_SECRET, nunca usa o texto padrão público", () => {
    vi.stubEnv("ADMIN_JWT_SECRET", undefined as unknown as string);
    vi.stubEnv("JWT_SECRET", "x".repeat(40));
    const secret = loadConfig({ env: "development" }).adminJwtSecret;
    expect(secret).not.toBe("local-dev-admin-jwt-secret-change-me");
    expect(secret).not.toContain("x".repeat(10));
    expect(secret).toBe(createHmac("sha256", "x".repeat(40)).update("acessanet/admin-jwt/v1").digest("hex"));
  });

  it("ADMIN_JWT_SECRET explícito tem prioridade", () => {
    vi.stubEnv("ADMIN_JWT_SECRET", "segredo-explicito-com-mais-de-32-caracteres");
    expect(loadConfig({ env: "development" }).adminJwtSecret).toBe("segredo-explicito-com-mais-de-32-caracteres");
  });
});

describe("proxy", () => {
  it("por padrão confia só no loopback; TRUST_PROXY=false desliga", () => {
    vi.stubEnv("TRUST_PROXY", undefined as unknown as string);
    expect(loadConfig({ env: "development" }).trustProxy).toBe("127.0.0.1,::1");
    vi.stubEnv("TRUST_PROXY", "false");
    expect(loadConfig({ env: "development" }).trustProxy).toBe(false);
  });

  it("X-Forwarded-For só vale quando a conexão vem do proxy local", async () => {
    const container = createContainer({ env: "test", sqlitePath: ":memory:", sgp: { basicUsername: "t", basicPassword: "t" }, trustProxy: "127.0.0.1,::1" });
    const app = await buildApp(container);
    app.get("/__ip", async (request) => ({ ip: request.ip }));
    const viaProxy = await app.inject({ method: "GET", url: "/__ip", remoteAddress: "127.0.0.1", headers: { "x-forwarded-for": "203.0.113.9" } });
    expect(viaProxy.json().ip).toBe("203.0.113.9");
    const spoof = await app.inject({ method: "GET", url: "/__ip", remoteAddress: "198.51.100.7", headers: { "x-forwarded-for": "203.0.113.9" } });
    expect(spoof.json().ip).toBe("198.51.100.7");
    await app.close();
  });
});

describe("rota de debug da OLT", () => {
  it("não existe sem token configurado; com token exige o header", async () => {
    const base = { env: "test" as const, sqlitePath: ":memory:", sgp: { basicUsername: "t", basicPassword: "t" } };
    const open = await buildApp(createContainer({ ...base, oltCloud: { debug: { enabled: true } } } as never));
    expect((await open.inject({ method: "GET", url: "/api/debug/oltcloud/client-status/1" })).statusCode).toBe(401);
    await open.close();
  });
});

describe("alcance por cargo", () => {
  it("viewer só alcança avisos e sessão; vendedor só contratações e sessão", () => {
    for (const url of ["/admin/api/notices", "/admin/api/notices/3/history", "/admin/api/auth/me"]) expect(roleCanReachAdminPath("viewer", url)).toBe(true);
    for (const url of ["/admin/api/chamados", "/admin/api/job-applications/1/file", "/admin/api/bug-reports", "/admin/api/oltcloud/clients", "/admin/api/analytics/clients", "/admin/api/noticesX"]) {
      expect(roleCanReachAdminPath("viewer", url)).toBe(false);
    }
    expect(roleCanReachAdminPath("vendedor", "/admin/api/contratacoes?search=a")).toBe(true);
    expect(roleCanReachAdminPath("vendedor", "/admin/api/notices")).toBe(false);
    expect(roleCanReachAdminPath("admin", "/admin/api/chamados")).toBe(true);
  });
});

describe("limitador", () => {
  it("descarta chaves vencidas para não crescer sem limite", () => {
    const limiter = new InMemoryRateLimiter();
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    for (let i = 0; i < 5001; i += 1) limiter.consume(`k${i}`, { limit: 5, windowMs: 10 });
    now.mockReturnValue(1_000_000);
    limiter.consume("novo", { limit: 5, windowMs: 10 });
    expect((limiter as unknown as { buckets: Map<string, unknown> }).buckets.size).toBeLessThan(10);
    now.mockRestore();
  });
});
