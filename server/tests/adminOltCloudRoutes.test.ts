import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createContainer, type AppContainer } from "../src/container.js";
import { hashPassword } from "../src/security/hash.js";

describe("GET /admin/api/oltcloud/clients", () => {
  it("nunca devolve o PPPoE nem a senha, só a máscara", async () => {
    const container = createContainer({ env: "test", sqlitePath: ":memory:", sgp: { basicUsername: "test", basicPassword: "test" } });
    (container as { oltCloud: unknown }).oltCloud = {
      client: {
        listClients: async () => [
          { id: 1, client_name: "Maria", pppoe: "maria.silva@provedor", pppoe_password: "segredo123", external_contract_id: "5932", document: "12345678909" },
          { id: 2, client_name: "Sem PPPoE", external_contract_id: "6000" }
        ]
      }
    };
    const app = await buildApp(container as AppContainer);
    await container.adminUsers.create({ id: "adm1", email: "a@x.test", name: "A", passwordHash: await hashPassword("Senha-de-teste-123"), role: "admin" });
    const login = await app.inject({ method: "POST", url: "/admin/api/auth/login", payload: { email: "a@x.test", password: "Senha-de-teste-123" } });
    const token = `Bearer ${login.json().accessToken as string}`;

    const response = await app.inject({ method: "GET", url: "/admin/api/oltcloud/clients?name=Maria", headers: { authorization: token } });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("maria.silva");
    expect(response.body).not.toContain("segredo123");
    const clients = response.json().clients as Array<{ pppoe: string | null }>;
    expect(clients[0]?.pppoe).toBe("************");
    expect(clients[1]?.pppoe).toBeNull();
    await app.close();
  });
});
