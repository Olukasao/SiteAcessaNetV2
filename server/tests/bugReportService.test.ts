import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/repositories/sqlite.js";
import { SqliteBugReportRepository } from "../src/repositories/bugReportRepository.js";
import { BugReportService } from "../src/services/bugReportService.js";
import { InMemoryStore } from "../src/repositories/inMemoryStore.js";
import { InMemoryRateLimiter } from "../src/auth/rateLimiter.js";
import type { AuthProfileRepository } from "../src/repositories/authProfileRepository.js";
import type { ContractSummary } from "../src/types.js";

function buildService() {
  const db = createDatabase(":memory:");
  const store = new InMemoryStore();
  const customer = store.upsertCustomer({
    id: "customer_1",
    name: "Cliente Teste",
    cpf: "12345678909",
    phone: "11999999999",
    email: "cliente@example.com"
  });
  const contract: ContractSummary = {
    id: "18082",
    customerId: customer.id,
    addressLine: "Rua Teste, 123",
    city: "São Paulo",
    state: "SP",
    planName: "Fibra 600M",
    status: "ACTIVE"
  };
  store.upsertContract(contract);

  const authProfiles: AuthProfileRepository = {
    findByCpfHash: async () => ({
      cpfHash: customer.cpfHash,
      sgpCustomerId: "18139",
      cpfLastDigits: "09",
      firstAccessCompleted: true,
      passwordChangedAt: null,
      lastLoginAt: null,
      lastLoginIpHash: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    getOrCreate: async () => {
      throw new Error("not used");
    },
    markFirstAccessCompleted: async () => undefined,
    markPasswordChanged: async () => undefined,
    recordSuccessfulLogin: async () => undefined,
    setPasswordHash: async () => undefined
  };

  const repository = new SqliteBugReportRepository(db);
  const service = new BugReportService(repository, store, authProfiles, new InMemoryRateLimiter(), {} as never);
  return { service, repository, auth: { customerId: customer.id, sessionId: "sess_1", cpfHash: customer.cpfHash } };
}

function request() {
  return {
    ip: "127.0.0.1",
    headers: { "user-agent": "Vitest" },
    url: "/api/bug-reports",
    routeOptions: { url: "/api/bug-reports" },
    log: { warn: () => undefined }
  } as never;
}

describe("BugReportService", () => {
  it("cria relatorio usando identidade autenticada e remove identidade enviada no contexto", async () => {
    const { service, auth } = buildService();

    const report = await service.createAuthenticated({
      auth,
      request: request(),
      category: "Status da conexão",
      description: "Minha conexão aparece offline na tela.",
      contractId: "18082",
      page: "/cliente/internet",
      url: "https://acessanet.com.br/cliente/internet",
      frontendVersion: "test-version",
      clientContext: {
        customerId: "customer_de_outro_cliente",
        cpf: "00000000000",
        nomeCliente: "Outro Cliente",
        statusConexaoExibido: "OFFLINE"
      }
    });

    expect(report.customerId).toBe(auth.customerId);
    expect(report.customerName).toBe("Cliente Teste");
    expect(report.cpfMasked).toBe("***.***.***-09");
    expect(report.contractId).toBe("18082");
    expect(report.context?.customerId).toBeUndefined();
    expect(report.context?.cpf).toBeUndefined();
    expect(report.context?.nomeCliente).toBeUndefined();
    expect(report.context?.statusConexaoExibido).toBe("OFFLINE");
  });

  it("rejeita contrato que nao pertence ao cliente autenticado", async () => {
    const { service, auth } = buildService();

    await expect(
      service.createAuthenticated({
        auth,
        request: request(),
        category: "Contratos",
        description: "Tentativa de vincular outro contrato.",
        contractId: "contrato_de_outro_cliente"
      })
    ).rejects.toMatchObject({ statusCode: 404, code: "RESOURCE_NOT_FOUND" });
  });

  it("limita spam de relatorios por cliente", async () => {
    const { service, auth } = buildService();

    for (let index = 0; index < 5; index += 1) {
      await service.createAuthenticated({
        auth,
        request: request(),
        category: "Outro",
        description: `Relatorio valido numero ${index + 1}.`
      });
    }

    await expect(
      service.createAuthenticated({
        auth,
        request: request(),
        category: "Outro",
        description: "Sexto relatorio deve bater no rate limit."
      })
    ).rejects.toMatchObject({ statusCode: 429, code: "RATE_LIMITED" });
  });

  it("admin altera status e notas com historico persistido", async () => {
    const { service, repository, auth } = buildService();
    const report = await service.createAuthenticated({
      auth,
      request: request(),
      category: "Interface / visual",
      description: "Um botão ficou desalinhado no celular."
    });

    const updated = await service.updateAdmin({
      id: report.id,
      status: "analisando",
      adminNotes: "Reproduzido em tela pequena.",
      adminUserId: "admin_1",
      adminEmail: "admin@acessanet.com"
    });
    const history = await repository.listHistory(report.id);

    expect(updated.status).toBe("analisando");
    expect(updated.adminNotes).toBe("Reproduzido em tela pequena.");
    expect(history).toHaveLength(1);
    expect(history[0]!).toMatchObject({ beforeStatus: "novo", afterStatus: "analisando" });
  });
});
