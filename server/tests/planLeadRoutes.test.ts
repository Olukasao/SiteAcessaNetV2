import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createContainer } from "../src/container.js";

function testContainer() {
  // Mesmo setup dos outros testes de rota: SQLite em memoria, SGP so
  // "habilitado" pro container subir (nenhuma chamada real).
  return createContainer({
    env: "test",
    sqlitePath: ":memory:",
    sgp: { basicUsername: "test", basicPassword: "test" }
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    planId: "800",
    planName: "Plano 800 Mega",
    planPrice: "R$ 169,99",
    name: "João Pereira",
    phone: "(11) 98888-7777",
    cep: "07700000",
    street: "Rua das Flores",
    number: "120",
    complement: "Casa 2",
    district: "Centro",
    city: "Caieiras",
    uf: "SP",
    contactPeriod: "tarde",
    coverageOk: true,
    ...overrides
  };
}

describe("POST /api/leads/plan", () => {
  it("registra o pedido sem login, com CEP formatado e status novo", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await app.inject({ method: "POST", url: "/api/leads/plan", payload: payload() });

    expect(response.statusCode).toBe(201);
    const saved = await container.planLeads.findById(response.json().id as number);
    expect(saved?.planName).toBe("Plano 800 Mega");
    expect(saved?.cep).toBe("07700-000");
    expect(saved?.coverageOk).toBe(true);
    expect(saved?.status).toBe("novo");
    expect(await container.planLeads.countNew()).toBe(1);
    await app.close();
  });

  it("recusa telefone sem DDD e CEP incompleto", async () => {
    const app = await buildApp(testContainer());
    const badPhone = await app.inject({ method: "POST", url: "/api/leads/plan", payload: payload({ phone: "98888" }) });
    const badCep = await app.inject({ method: "POST", url: "/api/leads/plan", payload: payload({ cep: "0770" }) });
    expect(badPhone.statusCode).toBe(400);
    expect(badCep.statusCode).toBe(400);
    await app.close();
  });

  it("finge sucesso e nao grava quando o campo isca vem preenchido", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await app.inject({ method: "POST", url: "/api/leads/plan", payload: payload({ website: "spam" }) });
    expect(response.statusCode).toBe(201);
    expect((await container.planLeads.list({ page: 1, limit: 10 })).total).toBe(0);
    await app.close();
  });

  it("limita envios repetidos do mesmo IP", async () => {
    const app = await buildApp(testContainer());
    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      codes.push((await app.inject({ method: "POST", url: "/api/leads/plan", payload: payload() })).statusCode);
    }
    expect(codes.slice(0, 5).every((code) => code === 201)).toBe(true);
    expect(codes[5]).toBe(429);
    await app.close();
  });
});

describe("rotas admin de leads", () => {
  it("exigem autenticacao de admin", async () => {
    const app = await buildApp(testContainer());
    for (const [method, url] of [
      ["GET", "/admin/api/plan-leads"],
      ["GET", "/admin/api/plan-leads/summary"],
      ["PATCH", "/admin/api/plan-leads/1"]
    ] as const) {
      const response = await app.inject({ method, url, payload: method === "PATCH" ? { status: "em_contato" } : undefined });
      expect(response.statusCode).toBe(401);
    }
    await app.close();
  });
});
