import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createContainer, type AppContainer } from "../src/container.js";
import { hasPermission } from "../src/auth/adminPermissions.js";
import type { AdminRole } from "../src/auth/adminPermissions.js";
import { hashPassword } from "../src/security/hash.js";
import { isCityCovered } from "../src/contracting/planCatalog.js";
import { CONTRACT_PROTOCOL_PATTERN } from "../src/contracting/protocol.js";
import { parseTrustProxy } from "../src/config.js";

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
    idempotencyKey: randomUUID(),
    planId: "800",
    address: {
      cep: "07700-000",
      street: "Rua das Flores",
      number: "120",
      complement: "Casa 2",
      district: "Centro",
      city: "Caieiras",
      uf: "sp"
    },
    customer: { name: "João Pereira", whatsapp: "(11) 98888-7777", email: "Joao@Example.com", cpf: "529.982.247-25" },
    contactPeriod: "tarde",
    notes: "Perto da padaria",
    privacyNoticeAck: true,
    marketingOptIn: false,
    ...overrides
  };
}

let ipCounter = 0;
function freshIp() {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

async function submit(app: FastifyInstance, body: Record<string, unknown>, remoteAddress = freshIp()) {
  return app.inject({ method: "POST", url: "/api/contratacao/solicitacoes", payload: body, remoteAddress });
}

const PASSWORD = "Senha-de-teste-123";

async function adminToken(app: FastifyInstance, container: AppContainer, role: AdminRole, id = `adm_${role}`) {
  await container.adminUsers.create({
    id,
    email: `${id}@acessanet.test`,
    name: `Admin ${role}`,
    passwordHash: await hashPassword(PASSWORD),
    role
  });
  const response = await app.inject({
    method: "POST",
    url: "/admin/api/auth/login",
    payload: { email: `${id}@acessanet.test`, password: PASSWORD },
    remoteAddress: freshIp()
  });
  expect(response.statusCode).toBe(200);
  return `Bearer ${response.json().accessToken as string}`;
}

describe("GET /api/contratacao/planos", () => {
  it("lista o catalogo do servidor sem login", async () => {
    const app = await buildApp(testContainer());
    const response = await app.inject({ method: "GET", url: "/api/contratacao/planos" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.plans.map((plan: { id: string }) => plan.id)).toEqual(["700", "700-fixo", "800"]);
    const plan800 = body.plans.find((plan: { id: string }) => plan.id === "800");
    expect(plan800.priceCents).toBe(16999);
    expect(plan800.priceText).toBe("R$ 169,99");
    expect(plan800.pendingConfirmation).toEqual(["espn", "livros", "fixo"]);
    expect(body.coveredCities).toContain("Franco da Rocha");
    expect(typeof body.privacyNoticeVersion).toBe("string");
    await app.close();
  });

  it("devolve um plano por id e 404 PLAN_NOT_FOUND para id desconhecido", async () => {
    const app = await buildApp(testContainer());
    const ok = await app.inject({ method: "GET", url: "/api/contratacao/planos/700-fixo" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().plan.name).toBe("Plano 700 Mega + Telefone Fixo");
    const missing = await app.inject({ method: "GET", url: "/api/contratacao/planos/999" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("PLAN_NOT_FOUND");
    await app.close();
  });
});

describe("POST /api/contratacao/solicitacoes", () => {
  it("cria a solicitacao com protocolo, status novo e evento created", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await submit(app, payload());

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.protocol).toMatch(CONTRACT_PROTOCOL_PATTERN);
    expect(body.status).toBe("novo");
    expect(body.plan).toEqual({ id: "800", name: "Plano 800 Mega", priceText: "R$ 169,99" });
    expect(body.coverage).toEqual({ cityCovered: true, technicalFeasibility: "pendente" });

    const { items } = await container.contractRequests.list({ page: 1, limit: 10 });
    expect(items).toHaveLength(1);
    const saved = await container.contractRequests.findById(items[0]!.id);
    expect(saved?.protocol).toBe(body.protocol);
    expect(saved?.whatsapp).toBe("11988887777");
    expect(saved?.email).toBe("joao@example.com");
    expect(saved?.uf).toBe("SP");
    expect(saved?.cep).toBe("07700-000");
    expect(saved?.marketingOptIn).toBe(false);
    const events = await container.contractRequests.listEvents(saved!.id);
    expect(events.map((event) => event.type)).toEqual(["created"]);
    expect(await container.contractRequests.countNew()).toBe(1);
    await app.close();
  });

  it("grava preco e nome do catalogo do servidor mesmo que o cliente mande outros", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await submit(
      app,
      payload({ planId: "700", planName: "Plano Grátis", priceCents: 1, priceText: "R$ 0,01", planPrice: "R$ 0,01" })
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().plan).toEqual({ id: "700", name: "Plano 700 Mega", priceText: "R$ 114,99" });
    const { items } = await container.contractRequests.list({ page: 1, limit: 10 });
    const saved = await container.contractRequests.findById(items[0]!.id);
    expect(saved?.planPriceCents).toBe(11499);
    expect(saved?.planName).toBe("Plano 700 Mega");
    await app.close();
  });

  it("calcula cidade atendida no servidor, ignorando acentos e caixa", async () => {
    expect(isCityCovered("  FRANCO   DA rócha ")).toBe(true);
    expect(isCityCovered("São Paulo")).toBe(false);
    const app = await buildApp(testContainer());
    const outside = await submit(app, payload({ address: { ...payload().address, city: "São Paulo" }, cityCovered: true }));
    expect(outside.statusCode).toBe(201);
    expect(outside.json().coverage.cityCovered).toBe(false);
    await app.close();
  });

  it("recusa dados invalidos com VALIDATION_ERROR", async () => {
    const app = await buildApp(testContainer());
    const base = payload();
    const invalid: Record<string, unknown>[] = [
      { address: { ...base.address, cep: "0770" } },
      { address: { ...base.address, cep: "07700-0001" } },
      { customer: { ...base.customer, whatsapp: "98888-7777" } },
      { customer: { ...base.customer, whatsapp: "(20) 98888-7777" } },
      { customer: { ...base.customer, whatsapp: "(11) 88888-7777" } },
      { customer: { ...base.customer, email: "nao-e-email" } },
      { customer: { ...base.customer, name: "João" } },
      { customer: { ...base.customer, name: "x".repeat(121) + " silva" } },
      { notes: "a".repeat(501) },
      { privacyNoticeAck: false },
      { privacyNoticeAck: "true" },
      { idempotencyKey: "123" },
      { contactPeriod: "madrugada" }
    ];
    for (const override of invalid) {
      const response = await submit(app, payload(override));
      expect(response.statusCode, JSON.stringify(override)).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    }
    const missingAck = payload();
    delete (missingAck as Record<string, unknown>).privacyNoticeAck;
    expect((await submit(app, missingAck)).statusCode).toBe(400);
    await app.close();
  });

  it("exige e-mail (vazio, só espaços ou ausente são recusados) e aceita WhatsApp fixo de 10 digitos", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const base = payload();
    for (const email of ["", "   ", undefined]) {
      const { email: _omit, ...customerWithoutEmail } = base.customer;
      const customer = email === undefined ? customerWithoutEmail : { ...base.customer, email };
      const refused = await submit(app, payload({ customer }));
      expect(refused.statusCode).toBe(400);
      expect(JSON.stringify(refused.json())).toMatch(/e-mail/i);
    }
    expect((await container.contractRequests.list({ page: 1, limit: 10 })).total).toBe(0);

    const response = await submit(app, payload({ customer: { ...base.customer, whatsapp: "1144445555" } }));
    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it("responde 404 PLAN_NOT_FOUND para plano inexistente sem gravar", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await submit(app, payload({ planId: "1000" }));
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("PLAN_NOT_FOUND");
    expect((await container.contractRequests.list({ page: 1, limit: 10 })).total).toBe(0);
    await app.close();
  });

  it("finge sucesso com resposta plausivel e nao grava quando o campo isca vem preenchido", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await submit(app, payload({ website: "http://spam.example" }));
    expect(response.statusCode).toBe(201);
    expect(response.json().protocol).toMatch(CONTRACT_PROTOCOL_PATTERN);
    expect(response.json().plan.id).toBe("800");
    expect((await container.contractRequests.list({ page: 1, limit: 10 })).total).toBe(0);
    await app.close();
  });

  it("reenvio com a mesma idempotencyKey devolve 200 com o mesmo protocolo, sem novo registro", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const body = payload();
    const first = await submit(app, body);
    const second = await submit(app, { ...body, customer: { ...body.customer, name: "Outro Nome" } });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().protocol).toBe(first.json().protocol);
    expect((await container.contractRequests.list({ page: 1, limit: 10 })).total).toBe(1);
    await app.close();
  });

  it("limita envios repetidos do mesmo IP", async () => {
    const app = await buildApp(testContainer());
    const ip = freshIp();
    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      codes.push((await submit(app, payload(), ip)).statusCode);
    }
    expect(codes.slice(0, 5).every((code) => code === 201)).toBe(true);
    expect(codes[5]).toBe(429);
    await app.close();
  });
});

describe("rotas admin de contratacoes", () => {
  it("exigem autenticacao de admin (401)", async () => {
    const app = await buildApp(testContainer());
    for (const [method, url] of [
      ["GET", "/admin/api/contratacoes"],
      ["GET", "/admin/api/contratacoes/summary"],
      ["GET", "/admin/api/contratacoes/assignees"],
      ["GET", "/admin/api/contratacoes/1"],
      ["PATCH", "/admin/api/contratacoes/1"]
    ] as const) {
      const response =
        method === "PATCH"
          ? await app.inject({ method, url, payload: { status: "em_analise" } })
          : await app.inject({ method, url });
      expect(response.statusCode, url).toBe(401);
    }
    await app.close();
  });

  it("viewer recebe 403 (dados pessoais); admin e editor tem as duas permissoes", async () => {
    expect(hasPermission("admin", "contratacoes.read")).toBe(true);
    expect(hasPermission("admin", "contratacoes.update")).toBe(true);
    expect(hasPermission("editor", "contratacoes.read")).toBe(true);
    expect(hasPermission("editor", "contratacoes.update")).toBe(true);
    expect(hasPermission("viewer", "contratacoes.read")).toBe(false);
    expect(hasPermission("viewer", "contratacoes.update")).toBe(false);

    const container = testContainer();
    const app = await buildApp(container);
    const viewer = await adminToken(app, container, "viewer");
    for (const url of ["/admin/api/contratacoes", "/admin/api/contratacoes/summary", "/admin/api/contratacoes/1"]) {
      const response = await app.inject({ method: "GET", url, headers: { authorization: viewer } });
      expect(response.statusCode, url).toBe(403);
    }
    const patch = await app.inject({
      method: "PATCH",
      url: "/admin/api/contratacoes/1",
      headers: { authorization: viewer },
      payload: { status: "em_analise" }
    });
    expect(patch.statusCode).toBe(403);
    await app.close();
  });

  it("lista com filtros de status, plano, data, protocolo e busca", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const token = await adminToken(app, container, "editor");
    const base = payload();

    const a = (await submit(app, payload({ planId: "800" }))).json();
    await submit(app, payload({ planId: "700", customer: { ...base.customer, name: "Maria Souza", whatsapp: "11977776666" } }));
    await submit(app, payload({ planId: "700-fixo", address: { ...base.address, city: "Francisco Morato" } }));

    async function list(query: string) {
      const response = await app.inject({ method: "GET", url: `/admin/api/contratacoes${query}`, headers: { authorization: token } });
      expect(response.statusCode, query).toBe(200);
      return response.json() as { items: Array<{ protocol: string; planId: string; customerName: string }>; total: number };
    }

    expect((await list("")).total).toBe(3);
    expect((await list("?planId=700")).items.map((item) => item.planId)).toEqual(["700"]);
    expect((await list("?status=novo")).total).toBe(3);
    expect((await list("?status=contratado")).total).toBe(0);
    expect((await list(`?protocol=${a.protocol.toLowerCase()}`)).items.map((item) => item.protocol)).toEqual([a.protocol]);
    expect((await list("?search=maria")).items.map((item) => item.customerName)).toEqual(["Maria Souza"]);
    expect((await list("?search=(11)%2097777")).total).toBe(1);
    expect((await list("?search=morato")).total).toBe(1);
    expect((await list("?search=%25")).total).toBe(0);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    expect((await list(`?from=${today}&to=${today}`)).total).toBe(3);
    expect((await list("?from=2020-01-01&to=2020-01-31")).total).toBe(0);

    const bad = await app.inject({ method: "GET", url: "/admin/api/contratacoes?from=2026-13-01", headers: { authorization: token } });
    expect(bad.statusCode).toBe(400);
    const summary = await app.inject({ method: "GET", url: "/admin/api/contratacoes/summary", headers: { authorization: token } });
    expect(summary.json()).toEqual({ newCount: 3 });
    await app.close();
  });

  it("PATCH gera eventos de status, responsavel e nota, e tudo e auditado sem dados pessoais", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const token = await adminToken(app, container, "admin");
    await adminToken(app, container, "editor", "adm_atendente");
    const recordSpy = vi.spyOn(container.adminAuditLog, "record");

    await submit(app, payload());
    const listed = await app.inject({ method: "GET", url: "/admin/api/contratacoes?search=jo%C3%A3o", headers: { authorization: token } });
    const id = listed.json().items[0].id as number;

    const assignees = await app.inject({ method: "GET", url: "/admin/api/contratacoes/assignees", headers: { authorization: token } });
    expect(assignees.json().items.map((item: { id: string }) => item.id).sort()).toEqual(["adm_admin", "adm_atendente"]);
    expect(JSON.stringify(assignees.json())).not.toContain("password");

    const patched = await app.inject({
      method: "PATCH",
      url: `/admin/api/contratacoes/${id}`,
      headers: { authorization: token },
      payload: { status: "em_atendimento", assignedAdminId: "adm_atendente", note: "Cliente pediu contato após 18h." }
    });
    expect(patched.statusCode).toBe(200);
    const body = patched.json();
    expect(body.request.status).toBe("em_atendimento");
    expect(body.request.assignedAdminName).toBe("Admin editor");
    expect(body.events.map((event: { type: string }) => event.type)).toEqual(["created", "status_changed", "assigned", "note"]);
    const statusEvent = body.events[1];
    expect(statusEvent).toMatchObject({ fromValue: "novo", toValue: "em_atendimento", adminId: "adm_admin", adminName: "Admin admin" });

    // Mesmo status de novo: nenhuma mudanca efetiva, nenhum evento novo.
    const same = await app.inject({
      method: "PATCH",
      url: `/admin/api/contratacoes/${id}`,
      headers: { authorization: token },
      payload: { status: "em_atendimento" }
    });
    expect(same.json().events).toHaveLength(4);

    const unassign = await app.inject({
      method: "PATCH",
      url: `/admin/api/contratacoes/${id}`,
      headers: { authorization: token },
      payload: { assignedAdminId: null }
    });
    expect(unassign.json().request.assignedAdminId).toBeNull();

    const badAssignee = await app.inject({
      method: "PATCH",
      url: `/admin/api/contratacoes/${id}`,
      headers: { authorization: token },
      payload: { assignedAdminId: "adm_inexistente" }
    });
    expect(badAssignee.statusCode).toBe(400);
    const empty = await app.inject({ method: "PATCH", url: `/admin/api/contratacoes/${id}`, headers: { authorization: token }, payload: {} });
    expect(empty.statusCode).toBe(400);
    const missing = await app.inject({
      method: "PATCH",
      url: "/admin/api/contratacoes/9999",
      headers: { authorization: token },
      payload: { status: "cancelado" }
    });
    expect(missing.statusCode).toBe(404);

    const detail = await app.inject({ method: "GET", url: `/admin/api/contratacoes/${id}`, headers: { authorization: token } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().request.email).toBe("joao@example.com");
    expect(detail.json().events.map((event: { type: string }) => event.type)).toEqual([
      "created",
      "status_changed",
      "assigned",
      "note",
      "assigned"
    ]);

    const actions = recordSpy.mock.calls.map(([entry]) => entry.action);
    expect(actions).toContain("VIEW_CONTRACT_REQUESTS");
    expect(actions).toContain("VIEW_CONTRACT_REQUEST");
    expect(actions.filter((action) => action === "UPDATE_CONTRACT_REQUEST")).toHaveLength(3);
    const serialized = JSON.stringify(recordSpy.mock.calls.map(([entry]) => [entry.beforeSnapshot, entry.afterSnapshot]));
    for (const personal of ["João", "jo%C3%A3o", "joão", "98888", "joao@example.com", "Rua das Flores", "18h"]) {
      expect(serialized).not.toContain(personal);
    }
    await app.close();
  });
});

describe("Fase 7 -- correcoes do QA", () => {
  it("M2: 400 e 404 nao consomem cota; o 429 traz Retry-After e retryAfterSeconds no corpo", async () => {
    const app = await buildApp(testContainer());
    const ip = freshIp();
    for (let i = 0; i < 8; i += 1) {
      expect((await submit(app, payload({ planId: "nao-existe" }), ip)).statusCode).toBe(404);
      expect((await submit(app, payload({ privacyNoticeAck: false }), ip)).statusCode).toBe(400);
    }
    const codes: number[] = [];
    for (let i = 0; i < 5; i += 1) codes.push((await submit(app, payload(), ip)).statusCode);
    expect(codes).toEqual([201, 201, 201, 201, 201]);

    const limited = await submit(app, payload(), ip);
    expect(limited.statusCode).toBe(429);
    const header = Number(limited.headers["retry-after"]);
    expect(header).toBeGreaterThan(0);
    expect(header).toBeLessThanOrEqual(3600);
    expect(limited.json().error.details.retryAfterSeconds).toBe(header);
    await app.close();
  });

  it("M5: corpo acima do limite -> 413 e JSON invalido -> 400, sem 500", async () => {
    const app = await buildApp(testContainer());
    const big = await app.inject({
      method: "POST",
      url: "/api/contratacao/solicitacoes",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(payload({ notes: "x".repeat(20 * 1024) })),
      remoteAddress: freshIp()
    });
    expect(big.statusCode).toBe(413);
    expect(big.json().error.code).toBe("PAYLOAD_TOO_LARGE");

    const broken = await app.inject({
      method: "POST",
      url: "/api/contratacao/solicitacoes",
      headers: { "content-type": "application/json" },
      payload: '{"planId": "800",',
      remoteAddress: freshIp()
    });
    expect(broken.statusCode).toBe(400);
    expect(broken.json().error.code).toBe("INVALID_REQUEST_BODY");
    expect(JSON.stringify(broken.json())).not.toMatch(/stack|SyntaxError/);

    // Rota existente com JSON invalido tambem passa a responder 400 (antes: 500).
    const lead = await app.inject({
      method: "POST",
      url: "/api/leads/plan",
      headers: { "content-type": "application/json" },
      payload: "{",
      remoteAddress: freshIp()
    });
    expect(lead.statusCode).toBe(400);
    await app.close();
  });

  it("mensagens de validacao chegam em pt-BR", async () => {
    const app = await buildApp(testContainer());
    const base = payload();
    const response = await submit(
      app,
      payload({ idempotencyKey: "abc", notes: "a".repeat(501), customer: { ...base.customer, email: "x@" } })
    );
    expect(response.statusCode).toBe(400);
    const fields = response.json().error.details.fieldErrors as Record<string, string[]>;
    expect(fields.idempotencyKey?.[0]).toMatch(/inválido/);
    expect(fields.notes?.[0]).toBe("Use no máximo 500 caracteres.");
    expect(fields.customer?.[0]).toBe("E-mail inválido.");
    expect(JSON.stringify(response.json())).not.toMatch(/Invalid|Too big|expected/);
    await app.close();
  });

  it("assignees lista so papeis com contratacoes.update e o PATCH recusa atribuir a viewer", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const token = await adminToken(app, container, "admin");
    await adminToken(app, container, "editor");
    await adminToken(app, container, "viewer");
    await submit(app, payload());

    const assignees = await app.inject({ method: "GET", url: "/admin/api/contratacoes/assignees", headers: { authorization: token } });
    expect(assignees.json().items.map((item: { id: string }) => item.id).sort()).toEqual(["adm_admin", "adm_editor"]);

    const toViewer = await app.inject({
      method: "PATCH",
      url: "/admin/api/contratacoes/1",
      headers: { authorization: token },
      payload: { assignedAdminId: "adm_viewer" }
    });
    expect(toViewer.statusCode).toBe(400);
    expect(toViewer.json().error.code).toBe("INVALID_ASSIGNEE");
    await app.close();
  });

  it("M3: TRUST_PROXY desligado por padrao e aceita true, hops ou lista", () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy(" 127.0.0.1 , 10.0.0.0/8 ")).toBe("127.0.0.1,10.0.0.0/8");
  });
});

describe("GET /admin/api/marketing/contract-leads", () => {
  it("lista so quem deu opt-in, e viewer nao ve", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    expect((await submit(app, payload({ marketingOptIn: true }))).statusCode).toBe(201);
    expect((await submit(app, payload())).statusCode).toBe(201);

    const url = "/admin/api/marketing/contract-leads";
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
    const viewer = await adminToken(app, container, "viewer");
    expect((await app.inject({ method: "GET", url, headers: { authorization: viewer } })).statusCode).toBe(403);

    const editor = await adminToken(app, container, "editor");
    const response = await app.inject({ method: "GET", url, headers: { authorization: editor } });
    expect(response.statusCode).toBe(200);
    const items = response.json().items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ customerName: "João Pereira", email: "joao@example.com", city: "Caieiras" });
    await app.close();
  });
});
