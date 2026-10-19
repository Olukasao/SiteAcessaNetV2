import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createContainer } from "../src/container.js";

function testContainer() {
  // Mesmo setup de adminMarketingRoutes.test.ts: SQLite em memoria, SGP so
  // "habilitado" pro container subir (nenhuma chamada real).
  return createContainer({
    env: "test",
    sqlitePath: ":memory:",
    sgp: { basicUsername: "test", basicPassword: "test" }
  });
}

const pdfBase64 = Buffer.from("%PDF-1.4\n% curriculo de teste\n").toString("base64");

function payload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Maria da Silva",
    email: "maria@example.com",
    phone: "(11) 99999-0000",
    area: "Atendimento",
    message: "Tenho experiência com atendimento ao cliente.",
    file: { name: "curriculo.pdf", data: pdfBase64 },
    ...overrides
  };
}

describe("POST /api/careers/applications", () => {
  it("aceita um PDF sem login e grava no banco", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await app.inject({ method: "POST", url: "/api/careers/applications", payload: payload() });

    expect(response.statusCode).toBe(201);
    const id = response.json().id as number;
    const saved = await container.jobApplications.findById(id);
    expect(saved?.name).toBe("Maria da Silva");
    expect(saved?.status).toBe("novo");
    expect(saved?.fileMime).toBe("application/pdf");
    const file = await container.jobApplications.getFile(id);
    expect(file?.data.subarray(0, 4).toString()).toBe("%PDF");
    await app.close();
  });

  it("recusa extensao nao permitida", async () => {
    const app = await buildApp(testContainer());
    const response = await app.inject({
      method: "POST",
      url: "/api/careers/applications",
      payload: payload({ file: { name: "virus.exe", data: pdfBase64 } })
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("recusa arquivo cujo conteudo nao bate com a extensao", async () => {
    const app = await buildApp(testContainer());
    const response = await app.inject({
      method: "POST",
      url: "/api/careers/applications",
      payload: payload({ file: { name: "curriculo.pdf", data: Buffer.from("MZ executavel").toString("base64") } })
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("recusa arquivo acima de 5 MB", async () => {
    const big = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(5 * 1024 * 1024 + 10)]).toString("base64");
    const app = await buildApp(testContainer());
    const response = await app.inject({
      method: "POST",
      url: "/api/careers/applications",
      payload: payload({ file: { name: "curriculo.pdf", data: big } })
    });
    expect([400, 413]).toContain(response.statusCode);
    await app.close();
  });

  it("finge sucesso e nao grava quando o campo isca vem preenchido", async () => {
    const container = testContainer();
    const app = await buildApp(container);
    const response = await app.inject({
      method: "POST",
      url: "/api/careers/applications",
      payload: payload({ website: "http://spam.example" })
    });
    expect(response.statusCode).toBe(201);
    const list = await container.jobApplications.list({ page: 1, limit: 10 });
    expect(list.total).toBe(0);
    await app.close();
  });

  it("limita envios repetidos do mesmo IP", async () => {
    const app = await buildApp(testContainer());
    const codes: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const response = await app.inject({ method: "POST", url: "/api/careers/applications", payload: payload() });
      codes.push(response.statusCode);
    }
    expect(codes.slice(0, 3)).toEqual([201, 201, 201]);
    expect(codes[3]).toBe(429);
    await app.close();
  });
});

describe("rotas admin de curriculos", () => {
  it("exigem autenticacao de admin", async () => {
    const app = await buildApp(testContainer());
    for (const url of ["/admin/api/job-applications", "/admin/api/job-applications/summary", "/admin/api/job-applications/1/file"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(401);
    }
    await app.close();
  });
});
