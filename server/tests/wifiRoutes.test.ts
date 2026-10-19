import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createContainer, type AppContainer } from "../src/container.js";
import { hashPassword } from "../src/security/hash.js";

const RADIUS_TOKEN = "token-do-radius-com-mais-de-32-caracteres!";

function testContainer(wifi: Record<string, unknown> = { radiusToken: RADIUS_TOKEN }) {
  return createContainer({ env: "test", sqlitePath: ":memory:", sgp: { basicUsername: "t", basicPassword: "t" }, wifi } as never);
}

let ipCounter = 0;
const freshIp = () => `10.9.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

function form(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Maria  da Silva",
    email: "Maria@Email.com",
    phone: "(11) 98888-7777",
    termsAccepted: true,
    marketingConsent: true,
    context: {
      loginUrl: "http://192.168.10.1:8080/cgi-bin/login",
      apMac: "AA:BB:CC:00:11:22",
      clientMac: "11-22-33-44-55-66",
      ssid: "AcessaNet Wi-Fi Padaria",
      origUrl: "http://example.com/noticia"
    },
    ...overrides
  };
}

const register = (app: FastifyInstance, payload: Record<string, unknown>, ip = freshIp()) =>
  app.inject({ method: "POST", url: "/api/wifi/cadastro", payload, remoteAddress: ip });

const authorize = (app: FastifyInstance, payload: Record<string, unknown>, token: string | null = RADIUS_TOKEN) =>
  app.inject({
    method: "POST",
    url: "/api/wifi/radius/authorize",
    payload,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });

function credentials(redirectUrl: string) {
  const url = new URL(redirectUrl);
  return { username: url.searchParams.get("username")!, password: url.searchParams.get("password")!, url };
}

describe("cadastro do Wi-Fi público", () => {
  it("grava visitante + consentimentos e devolve o login do AP com credenciais temporárias", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await register(app, form());
    expect(response.statusCode).toBe(201);
    const { username, password, url } = credentials(response.json().redirectUrl);
    expect(url.origin + url.pathname).toBe("http://192.168.10.1:8080/cgi-bin/login");
    expect(username).toMatch(/^wifi_[a-z0-9]+$/);
    expect(password.length).toBeGreaterThanOrEqual(20);
    expect(url.searchParams.get("redirect")).toBe("http://example.com/noticia");

    const leads = await container.wifi.listMarketingLeads(10);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ fullName: "Maria da Silva", email: "maria@email.com", phone: "11988887777", establishment: "AcessaNet Wi-Fi Padaria" });
    await app.close();
  });

  it("recusa login_url para fora da rede local (não vaza credenciais para outro site)", async () => {
    const app = await buildApp(testContainer());
    for (const loginUrl of ["https://evil.example.com/login", "javascript:alert(1)", "http://user:pass@192.168.0.1/", "http://8.8.8.8/login"]) {
      const response = await register(app, form({ context: { ...form().context, loginUrl } }));
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("INVALID_LOGIN_URL");
    }
    await app.close();
  });

  it("aceita host extra liberado em WIFI_LOGIN_HOSTS", async () => {
    const app = await buildApp(testContainer({ radiusToken: RADIUS_TOKEN, loginHosts: ["portal.gwn.local"] }));
    const response = await register(app, form({ context: { ...form().context, loginUrl: "https://portal.gwn.local/login" } }));
    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it("aberto fora do roteador: grava o cadastro sem gerar login", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await register(app, form({ context: {} }));
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ registered: true, redirectUrl: null });
    await app.close();
  });

  it("valida os campos e exige aceitar as condições", async () => {
    const app = await buildApp(testContainer());
    for (const overrides of [{ termsAccepted: false }, { email: "x@" }, { phone: "1188887777" }, { fullName: "Al" }]) {
      expect((await register(app, form(overrides))).statusCode).toBe(400);
    }
    await app.close();
  });

  it("opt-in mais recente vale: quem desmarca sai do Marketing", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    await register(app, form());
    await register(app, form({ marketingConsent: false }));
    expect(await container.wifi.listMarketingLeads(10)).toHaveLength(0);
    await app.close();
  });

  it("limita cadastros por IP", async () => {
    const app = await buildApp(testContainer());
    const ip = "10.250.0.1";
    for (let i = 0; i < 10; i += 1) expect((await register(app, form(), ip)).statusCode).toBe(201);
    expect((await register(app, form(), ip)).statusCode).toBe(429);
    await app.close();
  });
});

describe("autorização pelo RADIUS", () => {
  it("aceita as credenciais certas e devolve o tempo de sessão", async () => {
    const app = await buildApp(testContainer());
    const { username, password } = credentials((await register(app, form())).json().redirectUrl);
    const ok = await authorize(app, { username, password, clientMac: "11:22:33:44:55:66" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().accept).toBe(true);
    expect(ok.json().sessionTimeout).toBeGreaterThan(3 * 3600);
    await app.close();
  });

  it("recusa senha errada, usuário inexistente e outro aparelho", async () => {
    const app = await buildApp(testContainer());
    const { username, password } = credentials((await register(app, form())).json().redirectUrl);
    expect((await authorize(app, { username, password: "errada" })).json().accept).toBe(false);
    expect((await authorize(app, { username: "wifi_naoexiste", password })).json().accept).toBe(false);
    expect((await authorize(app, { username, password, clientMac: "99:99:99:99:99:99" })).json().accept).toBe(false);
    await app.close();
  });

  it("recusa credencial vencida", async () => {
    const app = await buildApp(testContainer({ radiusToken: RADIUS_TOKEN, sessionHours: -1 }));
    const { username, password } = credentials((await register(app, form())).json().redirectUrl);
    expect((await authorize(app, { username, password })).json().accept).toBe(false);
    await app.close();
  });

  it("exige o token do RADIUS; sem token configurado a rota não existe", async () => {
    const app = await buildApp(testContainer());
    expect((await authorize(app, { username: "a", password: "b" }, null)).statusCode).toBe(401);
    expect((await authorize(app, { username: "a", password: "b" }, "token-errado")).statusCode).toBe(401);
    await app.close();

    const closed = await buildApp(testContainer({}));
    expect((await authorize(closed, { username: "a", password: "b" })).statusCode).toBe(404);
    await closed.close();
  });
});

describe("tela Marketing", () => {
  it("lista os cadastros do Wi-Fi com opt-in para o admin", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    await register(app, form());
    await container.adminUsers.create({ id: "adm", email: "a@x.test", name: "A", passwordHash: await hashPassword("Senha-de-teste-123"), role: "admin" });
    const login = await app.inject({ method: "POST", url: "/admin/api/auth/login", payload: { email: "a@x.test", password: "Senha-de-teste-123" } });
    const response = await app.inject({ method: "GET", url: "/admin/api/marketing/leads", headers: { authorization: `Bearer ${login.json().accessToken as string}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({ fullName: "Maria da Silva", establishment: "AcessaNet Wi-Fi Padaria" });
    await app.close();
  });
});

export type { AppContainer };
