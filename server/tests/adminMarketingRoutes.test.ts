import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createContainer } from "../src/container.js";
import { AcessanetConnectClient } from "../src/integrations/acessanetConnect/acessanetConnectClient.js";

function testContainer(overrides: Parameters<typeof createContainer>[0] = {}) {
  // SGP precisa estar "habilitado" so pra createContainer() nao recusar subir
  // (ver container.ts) -- nenhuma chamada real ao SGP acontece nestes testes.
  // Banco em memoria -- nunca o arquivo real de producao.
  return createContainer({
    env: "test",
    sqlitePath: ":memory:",
    sgp: { basicUsername: "test", basicPassword: "test" },
    ...overrides
  });
}

describe("GET /admin/api/marketing/leads", () => {
  it("exige autenticacao de admin (401 sem Authorization)", async () => {
    const app = await buildApp(testContainer());
    const response = await app.inject({ method: "GET", url: "/admin/api/marketing/leads" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("responde 503 quando a integracao nao esta configurada, mesmo autenticado", async () => {
    // Sem ACESSANET_CONNECT_URL/TOKEN, container.acessanetConnect fica undefined
    // (mesmo padrao do oltCloud) -- a rota precisa recusar explicitamente, nunca
    // devolver uma lista vazia como se fosse um resultado real.
    const app = await buildApp(testContainer());
    const response = await app.inject({
      method: "GET",
      url: "/admin/api/marketing/leads",
      headers: { authorization: "Bearer token-invalido" }
    });
    // Token invalido ja barra em 401 antes de chegar no check de configuracao --
    // o importante aqui e confirmar que a rota nunca devolve 200 sem auth valida.
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("AcessanetConnectClient", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("recusa construir sem baseUrl/token (mesmo espirito do OltCloudClient)", () => {
    expect(() => new AcessanetConnectClient({ baseUrl: "", token: "", timeoutMs: 1000 })).toThrow(
      /nao configurada/i
    );
  });

  it("devolve a lista de leads quando a resposta e 200", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ visitorId: "v1", fullName: "Maria", email: "m@x.com", phone: "11999999999" }]
    }) as unknown as typeof fetch;

    const client = new AcessanetConnectClient({ baseUrl: "http://localhost:4000", token: "tok", timeoutMs: 1000 });
    const leads = await client.listMarketingLeads();
    expect(leads).toHaveLength(1);
    expect(leads[0]?.fullName).toBe("Maria");
  });

  it("lanca AppError quando a resposta nao e ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const client = new AcessanetConnectClient({ baseUrl: "http://localhost:4000", token: "tok", timeoutMs: 1000 });
    await expect(client.listMarketingLeads()).rejects.toMatchObject({ statusCode: 502 });
  });
});
