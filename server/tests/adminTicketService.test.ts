import { describe, expect, it, vi } from "vitest";
import { createDatabase } from "../src/repositories/sqlite.js";
import { SqliteCentralActivityRepository } from "../src/repositories/centralActivityRepository.js";
import { AdminTicketService } from "../src/support/adminTicketService.js";
import type { ContractProvider, TicketProvider, TicketSummaryWithRaw } from "../src/integrations/sgp/providers.js";
import type { ContractSummary } from "../src/types.js";

function buildOccurrence(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    numero: "238742",
    status: "aberto",
    data_cadastro: "2026-10-01",
    hora_cadastro: "08:31",
    tipo: "Sem internet",
    conteudo: "Estou sem internet desde ontem a noite.",
    ...overrides
  };
}

function buildProviders(occurrencesByContract: Record<string, Record<string, unknown>[]>) {
  const ticketProvider: TicketProvider = {
    createTicket: vi.fn(),
    getTicketStatus: vi.fn(),
    getTicketHistory: vi.fn(),
    listTicketsByContract: vi.fn().mockResolvedValue([]),
    listOccurrencesByContract: vi.fn(async (contractId: string) => {
      const raws = occurrencesByContract[contractId] ?? [];
      return raws.map((raw) => ({
        id: String(raw.numero),
        protocol: String(raw.numero),
        contractId,
        status: "RECEIVED",
        title: String(raw.tipo ?? ""),
        description: String(raw.conteudo ?? ""),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        raw
      })) as TicketSummaryWithRaw[];
    })
  };

  const contracts: Record<string, ContractSummary> = {};
  const contractProvider: ContractProvider = {
    getContracts: vi.fn().mockResolvedValue([]),
    getContract: vi.fn(async (contractId: string) => contracts[contractId] ?? null)
  };

  return { ticketProvider, contractProvider, contracts };
}

async function seedOpenTicket(
  repo: SqliteCentralActivityRepository,
  input: { customerId: string; contractId: string; protocol: string; title: string; customerName: string; cpfMasked: string }
) {
  await repo.record({
    sessionId: `session_${input.protocol}`,
    customerId: input.customerId,
    cpfHash: `hash_${input.customerId}`,
    cpfMasked: input.cpfMasked,
    customerName: input.customerName,
    sgpCustomerId: input.customerId,
    contractId: input.contractId,
    eventType: "OPEN_TICKET",
    page: "atendimento",
    metadata: { ticketId: `ticket_${input.protocol}`, protocol: input.protocol, title: input.title }
  });
}

const allTimeRange = { from: new Date(0), to: new Date("9999-12-31T23:59:59.999Z") };

describe("AdminTicketService", () => {
  it("nunca mistura contrato/descricao entre clientes diferentes no detalhe (isolamento critico)", async () => {
    const repo = new SqliteCentralActivityRepository(createDatabase(":memory:"));
    const { ticketProvider, contractProvider, contracts } = buildProviders({
      contract_100: [buildOccurrence({ numero: "1001", tipo: "Sem internet", conteudo: "Cliente A sem internet" })],
      contract_200: [buildOccurrence({ numero: "2002", tipo: "Internet lenta", conteudo: "Cliente B com lentidao" })]
    });
    contracts.contract_100 = {
      id: "contract_100",
      customerId: "customer_a",
      addressLine: "Rua A, 100",
      city: "Franco da Rocha",
      state: "SP",
      planName: "500 Mega",
      status: "ACTIVE"
    };
    contracts.contract_200 = {
      id: "contract_200",
      customerId: "customer_b",
      addressLine: "Rua B, 200",
      city: "Franco da Rocha",
      state: "SP",
      planName: "800 Mega",
      status: "ACTIVE"
    };

    await seedOpenTicket(repo, {
      customerId: "customer_a",
      contractId: "contract_100",
      protocol: "1001",
      title: "Sem internet",
      customerName: "Cliente A",
      cpfMasked: "***.***.***-01"
    });
    await seedOpenTicket(repo, {
      customerId: "customer_b",
      contractId: "contract_200",
      protocol: "2002",
      title: "Internet lenta",
      customerName: "Cliente B",
      cpfMasked: "***.***.***-02"
    });

    const service = new AdminTicketService(repo, ticketProvider, contractProvider);

    const detailA = await service.getDetail("1001");
    expect(detailA.customerId).toBe("customer_a");
    expect(detailA.contractId).toBe("contract_100");
    expect(detailA.contract?.addressLine).toBe("Rua A, 100");
    expect(detailA.description).toContain("Cliente A");
    expect(detailA.contract?.addressLine).not.toBe("Rua B, 200");

    const detailB = await service.getDetail("2002");
    expect(detailB.customerId).toBe("customer_b");
    expect(detailB.contractId).toBe("contract_200");
    expect(detailB.contract?.addressLine).toBe("Rua B, 200");
    expect(detailB.description).toContain("Cliente B");

    // Historico de A nunca deve incluir o chamado de B, mesmo que ambos existam na mesma tabela.
    expect(detailA.customerHistory.find((item) => item.protocol === "2002")).toBeUndefined();
    expect(detailA.contractHistory.find((item) => item.protocol === "2002")).toBeUndefined();
  });

  it("lista chamados com paginacao SQL quando nenhum filtro de status/updatedAt e usado", async () => {
    const repo = new SqliteCentralActivityRepository(createDatabase(":memory:"));
    const { ticketProvider, contractProvider } = buildProviders({});

    for (let i = 0; i < 5; i += 1) {
      await seedOpenTicket(repo, {
        customerId: `customer_${i}`,
        contractId: `contract_${i}`,
        protocol: `proto_${i}`,
        title: "Sem internet",
        customerName: `Cliente ${i}`,
        cpfMasked: "***.***.***-00"
      });
    }

    const service = new AdminTicketService(repo, ticketProvider, contractProvider);
    const result = await service.listTickets({ range: allTimeRange, page: 1, limit: 2, sort: "createdAt_desc" });

    expect(result.total).toBe(5);
    expect(result.items).toHaveLength(2);
    expect(result.truncated).toBe(false);
  });

  it("filtra por status real (grupo normalizado), nunca um valor inventado", async () => {
    const repo = new SqliteCentralActivityRepository(createDatabase(":memory:"));
    const { ticketProvider, contractProvider } = buildProviders({
      contract_open: [buildOccurrence({ numero: "p1", status: "aberto" })],
      contract_closed: [buildOccurrence({ numero: "p2", status: "encerrado", data_finalizacao: "2026-10-02" })]
    });

    await seedOpenTicket(repo, {
      customerId: "customer_open",
      contractId: "contract_open",
      protocol: "p1",
      title: "Sem internet",
      customerName: "Aberto",
      cpfMasked: "***.***.***-01"
    });
    await seedOpenTicket(repo, {
      customerId: "customer_closed",
      contractId: "contract_closed",
      protocol: "p2",
      title: "Sem internet",
      customerName: "Encerrado",
      cpfMasked: "***.***.***-02"
    });

    const service = new AdminTicketService(repo, ticketProvider, contractProvider);
    const openOnly = await service.listTickets({ range: allTimeRange, page: 1, limit: 10, status: "open", sort: "createdAt_desc" });

    expect(openOnly.items).toHaveLength(1);
    expect(openOnly.items[0]?.protocol).toBe("p1");

    const closedOnly = await service.listTickets({ range: allTimeRange, page: 1, limit: 10, status: "closed", sort: "createdAt_desc" });
    expect(closedOnly.items).toHaveLength(1);
    expect(closedOnly.items[0]?.protocol).toBe("p2");
  });

  it("exportCsv neutraliza celulas que comecam com '=' (CSV injection)", async () => {
    const repo = new SqliteCentralActivityRepository(createDatabase(":memory:"));
    const { ticketProvider, contractProvider } = buildProviders({
      contract_1: [buildOccurrence({ numero: "p1" })]
    });

    await seedOpenTicket(repo, {
      customerId: "customer_1",
      contractId: "contract_1",
      protocol: "p1",
      title: "=cmd|'/bin/sh'!A1",
      customerName: "Cliente",
      cpfMasked: "***.***.***-01"
    });

    const service = new AdminTicketService(repo, ticketProvider, contractProvider);
    const csv = await service.exportCsv({ range: allTimeRange, sort: "createdAt_desc" });

    expect(csv).not.toMatch(/;=cmd/);
    expect(csv).toContain("'=cmd");
  });
});
