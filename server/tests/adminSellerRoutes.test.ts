import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createContainer, type AppContainer } from "../src/container.js";
import type { AdminRole } from "../src/auth/adminPermissions.js";
import { hashPassword } from "../src/security/hash.js";

const PASSWORD = "Senha-de-teste-123";
const SELLER_PASSWORD = "Vendedora-forte-456";

function testContainer() {
  return createContainer({ env: "test", sqlitePath: ":memory:", sgp: { basicUsername: "test", basicPassword: "test" } });
}

let ipCounter = 0;
function freshIp() {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

async function login(app: FastifyInstance, email: string, password: string) {
  return app.inject({ method: "POST", url: "/admin/api/auth/login", payload: { email, password }, remoteAddress: freshIp() });
}

async function adminToken(app: FastifyInstance, container: AppContainer, role: AdminRole) {
  const email = `${role}@acessanet.test`;
  await container.adminUsers.create({ id: `adm_${role}`, email, name: `Admin ${role}`, passwordHash: await hashPassword(PASSWORD), role });
  const response = await login(app, email, PASSWORD);
  expect(response.statusCode).toBe(200);
  return `Bearer ${response.json().accessToken as string}`;
}

async function createSeller(app: FastifyInstance, token: string, name: string, email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/admin/api/vendedores",
    headers: { authorization: token },
    payload: { name, email, password: SELLER_PASSWORD }
  });
  expect(response.statusCode).toBe(201);
  const sellerLogin = await login(app, email, SELLER_PASSWORD);
  expect(sellerLogin.statusCode).toBe(200);
  return { id: response.json().id as string, token: `Bearer ${sellerLogin.json().accessToken as string}` };
}

async function submitRequest(app: FastifyInstance, container: AppContainer) {
  const response = await app.inject({
    method: "POST",
    url: "/api/contratacao/solicitacoes",
    remoteAddress: freshIp(),
    payload: {
      idempotencyKey: randomUUID(),
      planId: "800",
      address: { cep: "07700-000", street: "Rua das Flores", number: "1", district: "Centro", city: "Caieiras", uf: "SP" },
      customer: { name: "Cliente Teste", whatsapp: "(11) 98888-7777" },
      privacyNoticeAck: true
    }
  });
  expect(response.statusCode).toBe(201);
  // A resposta publica nao expoe o id interno: busca pelo protocolo.
  const list = await container.contractRequests.list({ page: 1, limit: 100, protocol: response.json().protocol as string });
  return list.items[0]!.id;
}

function patch(app: FastifyInstance, token: string, id: number, payload: Record<string, unknown>) {
  return app.inject({ method: "PATCH", url: `/admin/api/contratacoes/${id}`, headers: { authorization: token }, payload });
}

describe("contas de vendedor", () => {
  it("só o admin cria; e-mail repetido e senha curta são recusados", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const url = "/admin/api/vendedores";

    expect((await app.inject({ method: "POST", url, payload: {} })).statusCode).toBe(401);
    for (const role of ["editor", "viewer"] as const) {
      const token = await adminToken(app, container, role);
      const denied = await app.inject({ method: "POST", url, headers: { authorization: token }, payload: { name: "Ana", email: "ana@x.com", password: SELLER_PASSWORD } });
      expect(denied.statusCode).toBe(403);
    }

    const ok = await app.inject({ method: "POST", url, headers: { authorization: admin }, payload: { name: "Ana", email: "Ana@Loja.com", password: SELLER_PASSWORD } });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({ name: "Ana", email: "ana@loja.com", active: true });
    expect(JSON.stringify(ok.json())).not.toMatch(/hash|password/i);

    const duplicate = await app.inject({ method: "POST", url, headers: { authorization: admin }, payload: { name: "Ana 2", email: "ana@loja.com", password: SELLER_PASSWORD } });
    expect(duplicate.statusCode).toBe(409);
    const weak = await app.inject({ method: "POST", url, headers: { authorization: admin }, payload: { name: "Bia", email: "bia@loja.com", password: "curta" } });
    expect(weak.statusCode).toBe(400);

    const list = await app.inject({ method: "GET", url, headers: { authorization: admin } });
    expect(list.json().items).toHaveLength(1);
    expect((await container.adminUsers.findByEmail("ana@loja.com"))?.role).toBe("vendedor");
    await app.close();
  });

  it("vendedor só alcança login e contratações", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const seller = await createSeller(app, admin, "Ana", "ana@loja.com");

    for (const url of ["/admin/api/analytics/overview", "/admin/api/chamados", "/admin/api/marketing/contract-leads", "/admin/api/vendedores", "/admin/api/vendedores/ranking", "/admin/api/job-applications"]) {
      expect((await app.inject({ method: "GET", url, headers: { authorization: seller.token } })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: "GET", url: "/admin/api/contratacoes", headers: { authorization: seller.token } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/admin/api/auth/me", headers: { authorization: seller.token } })).json().role).toBe("vendedor");
    await app.close();
  });

  it("desativar derruba a sessão na hora e impede novo login; reativar volta", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const seller = await createSeller(app, admin, "Ana", "ana@loja.com");

    const off = await app.inject({ method: "PATCH", url: `/admin/api/vendedores/${seller.id}`, headers: { authorization: admin }, payload: { active: false } });
    expect(off.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/admin/api/contratacoes", headers: { authorization: seller.token } })).statusCode).toBe(401);
    expect((await login(app, "ana@loja.com", SELLER_PASSWORD)).statusCode).toBe(401);

    await app.inject({ method: "PATCH", url: `/admin/api/vendedores/${seller.id}`, headers: { authorization: admin }, payload: { active: true } });
    expect((await login(app, "ana@loja.com", SELLER_PASSWORD)).statusCode).toBe(200);
    await app.close();
  });

  it("redefinir a senha troca a senha e derruba as sessões; admin não é alterável por aqui", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const seller = await createSeller(app, admin, "Ana", "ana@loja.com");

    const reset = await app.inject({ method: "PATCH", url: `/admin/api/vendedores/${seller.id}`, headers: { authorization: admin }, payload: { password: "Outra-senha-forte-789" } });
    expect(reset.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/admin/api/contratacoes", headers: { authorization: seller.token } })).statusCode).toBe(401);
    expect((await login(app, "ana@loja.com", SELLER_PASSWORD)).statusCode).toBe(401);
    expect((await login(app, "ana@loja.com", "Outra-senha-forte-789")).statusCode).toBe(200);

    const other = await app.inject({ method: "PATCH", url: "/admin/api/vendedores/adm_admin", headers: { authorization: admin }, payload: { active: false } });
    expect(other.statusCode).toBe(404);
    await app.close();
  });
});

describe("atendimento e ranking", () => {
  it("quem atende um pedido sem responsável vira o responsável; colega não toma o pedido", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const ana = await createSeller(app, admin, "Ana", "ana@loja.com");
    const bia = await createSeller(app, admin, "Bia", "bia@loja.com");
    const id = await submitRequest(app, container);

    const taken = await patch(app, ana.token, id, { status: "em_atendimento" });
    expect(taken.statusCode).toBe(200);
    expect(taken.json().request.assignedAdminId).toBe(ana.id);

    expect((await patch(app, bia.token, id, { status: "contratado" })).statusCode).toBe(403);
    expect((await patch(app, bia.token, id, { assignedAdminId: bia.id })).statusCode).toBe(403);
    const other = await submitRequest(app, container);
    expect((await patch(app, bia.token, other, { assignedAdminId: ana.id })).statusCode).toBe(403);

    const assignees = await app.inject({ method: "GET", url: "/admin/api/contratacoes/assignees", headers: { authorization: ana.token } });
    expect(assignees.json().items.map((item: { id: string }) => item.id)).toEqual([ana.id]);
    await app.close();
  });

  it("ranking conta atendidos e contratados por vendedor, e mostra pedidos sem responsável", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const editor = await adminToken(app, container, "editor");
    const viewer = await adminToken(app, container, "viewer");
    const ana = await createSeller(app, admin, "Ana", "ana@loja.com");
    const bia = await createSeller(app, admin, "Bia", "bia@loja.com");
    await createSeller(app, admin, "Carla", "carla@loja.com");

    const [a1, a2, a3, b1] = [await submitRequest(app, container), await submitRequest(app, container), await submitRequest(app, container), await submitRequest(app, container)];
    await submitRequest(app, container); // fica sem responsavel
    await patch(app, ana.token, a1, { status: "contratado" });
    await patch(app, ana.token, a2, { status: "em_atendimento" });
    await patch(app, ana.token, a3, { assignedAdminId: ana.id }); // assumiu, ainda "novo": nao conta como atendido
    await patch(app, bia.token, b1, { status: "agendado" });

    const url = "/admin/api/vendedores/ranking?period=30d";
    expect((await app.inject({ method: "GET", url, headers: { authorization: viewer } })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url, headers: { authorization: ana.token } })).statusCode).toBe(403);

    for (const token of [admin, editor]) {
      const response = await app.inject({ method: "GET", url, headers: { authorization: token } });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.unassigned).toBe(1);
      expect(body.items.map((item: { name: string }) => item.name)).toEqual(["Ana", "Bia", "Carla"]);
      expect(body.items[0]).toMatchObject({ name: "Ana", assigned: 3, attended: 2, won: 1 });
      expect(body.items[1]).toMatchObject({ name: "Bia", assigned: 1, attended: 1, won: 0 });
      expect(body.items[2]).toMatchObject({ name: "Carla", assigned: 0, attended: 0, won: 0 });
    }

    // Periodo que nao inclui os pedidos de hoje: tudo zerado.
    const past = await app.inject({ method: "GET", url: "/admin/api/vendedores/ranking?period=custom&from=2020-01-01&to=2020-01-31", headers: { authorization: admin } });
    expect(past.json().items.every((item: { assigned: number }) => item.assigned === 0)).toBe(true);
    await app.close();
  });
});

describe("troca da própria senha", () => {
  it("vendedor troca a senha com a atual; sessões caem e a senha antiga para de valer", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const seller = await createSeller(app, admin, "Ana", "ana@loja.com");
    const url = "/admin/api/auth/change-password";
    const call = (payload: Record<string, unknown>) => app.inject({ method: "POST", url, headers: { authorization: seller.token }, payload });

    expect((await app.inject({ method: "POST", url, payload: {} })).statusCode).toBe(401);
    expect((await call({ currentPassword: "errada-errada-1", newPassword: "Senha-nova-forte-1" })).json().error.code).toBe("INVALID_CURRENT_PASSWORD");
    expect((await call({ currentPassword: SELLER_PASSWORD, newPassword: "curta" })).statusCode).toBe(400);
    expect((await call({ currentPassword: SELLER_PASSWORD, newPassword: SELLER_PASSWORD })).json().error.code).toBe("SAME_PASSWORD");
    // Senha atual errada nao pode derrubar a sessao (o front trata 401 como sessao expirada).
    expect((await app.inject({ method: "GET", url: "/admin/api/contratacoes", headers: { authorization: seller.token } })).statusCode).toBe(200);

    expect((await call({ currentPassword: SELLER_PASSWORD, newPassword: "Senha-nova-forte-1" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/admin/api/contratacoes", headers: { authorization: seller.token } })).statusCode).toBe(401);
    expect((await login(app, "ana@loja.com", SELLER_PASSWORD)).statusCode).toBe(401);
    expect((await login(app, "ana@loja.com", "Senha-nova-forte-1")).statusCode).toBe(200);
    await app.close();
  });
});

describe("troca de e-mail", () => {
  it("admin corrige o e-mail do vendedor; e-mail em uso é recusado; o login passa a ser o novo", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const ana = await createSeller(app, admin, "Ana", "ana@loja.com");
    await createSeller(app, admin, "Bia", "bia@loja.com");
    const patchEmail = (id: string, email: string, token = admin) =>
      app.inject({ method: "PATCH", url: `/admin/api/vendedores/${id}`, headers: { authorization: token }, payload: { email } });

    expect((await patchEmail(ana.id, "bia@loja.com")).statusCode).toBe(409);
    expect((await patchEmail(ana.id, "invalido")).statusCode).toBe(400);
    expect((await patchEmail(ana.id, "ana@loja.com", ana.token)).statusCode).toBe(403);

    const changed = await patchEmail(ana.id, "Ana.Nova@Loja.com");
    expect(changed.statusCode).toBe(200);
    expect(changed.json().email).toBe("ana.nova@loja.com");
    expect((await login(app, "ana@loja.com", SELLER_PASSWORD)).statusCode).toBe(401);
    expect((await login(app, "ana.nova@loja.com", SELLER_PASSWORD)).statusCode).toBe(200);
    await app.close();
  });

  it("a própria pessoa troca o e-mail com a senha atual", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const admin = await adminToken(app, container, "admin");
    const ana = await createSeller(app, admin, "Ana", "ana@loja.com");
    await createSeller(app, admin, "Bia", "bia@loja.com");
    const url = "/admin/api/auth/change-email";
    const call = (payload: Record<string, unknown>) => app.inject({ method: "POST", url, headers: { authorization: ana.token }, payload });

    expect((await app.inject({ method: "POST", url, payload: {} })).statusCode).toBe(401);
    expect((await call({ currentPassword: "errada-errada-1", newEmail: "x@loja.com" })).json().error.code).toBe("INVALID_CURRENT_PASSWORD");
    expect((await call({ currentPassword: SELLER_PASSWORD, newEmail: "bia@loja.com" })).statusCode).toBe(409);
    expect((await call({ currentPassword: SELLER_PASSWORD, newEmail: "ana@loja.com" })).json().error.code).toBe("SAME_EMAIL");

    const ok = await call({ currentPassword: SELLER_PASSWORD, newEmail: "ana.nova@loja.com" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().email).toBe("ana.nova@loja.com");
    // A sessao continua valida e /me mostra o e-mail novo.
    const me = await app.inject({ method: "GET", url: "/admin/api/auth/me", headers: { authorization: ana.token } });
    expect(me.json().email).toBe("ana.nova@loja.com");
    expect((await login(app, "ana.nova@loja.com", SELLER_PASSWORD)).statusCode).toBe(200);
    expect((await login(app, "ana@loja.com", SELLER_PASSWORD)).statusCode).toBe(401);
    await app.close();
  });
});
