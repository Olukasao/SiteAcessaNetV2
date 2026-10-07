import { describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "../src/repositories/inMemoryStore.js";
import { SupportService } from "../src/support/supportService.js";
import type { TicketProvider, NetworkProvider, AppointmentProvider, BillingProvider } from "../src/integrations/sgp/providers.js";
import { AppError } from "../src/errors.js";

function seedContract(store: InMemoryStore) {
  store.upsertCustomer({ id: "customer_lucas", name: "Lucas", cpf: "12345678909", phone: "11987654321" });
  const contract = store.upsertContract({
    id: "contract_lucas_home",
    customerId: "customer_lucas",
    addressLine: "Rua XXXXXXXXX",
    city: "Franco da Rocha",
    state: "SP",
    planName: "800 Mega",
    status: "ACTIVE"
  });
  store.connectionStatuses.set(contract.id, {
    contractId: contract.id,
    health: "NORMAL",
    contractStatus: "ACTIVE",
    onu: "ONLINE",
    pon: "ONLINE",
    pppoe: "ONLINE",
    opticalSignal: "NORMAL",
    knownIncident: false,
    updatedAt: new Date().toISOString()
  });
  return contract;
}

const mockAppointmentProvider: AppointmentProvider = { getAppointment: vi.fn().mockResolvedValue(null) };
const mockBillingProvider: BillingProvider = {
  getBillingSummary: vi.fn().mockResolvedValue({ contractId: "unused", status: "UNKNOWN", updatedAt: new Date().toISOString(), source: "mock" }),
  listInvoices: vi.fn().mockResolvedValue({ contractId: "unused", invoices: [], updatedAt: new Date().toISOString(), source: "mock" }),
  requestPaymentPromise: vi.fn()
};

describe("SupportService.createTicket", () => {
  it("preserva o diagnostico e grava auditoria de falha quando a criacao no SGP falha", async () => {
    const store = new InMemoryStore();
    const contract = seedContract(store);
    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn().mockRejectedValue(new AppError(502, "SGP_CHAMADO_REQUEST_FAILED", "Nao foi possivel abrir o chamado no SGP agora.")),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      listOccurrencesByContract: vi.fn().mockResolvedValue([])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, mockBillingProvider);

    const diagnosis = await service.diagnose({
      customerId: contract.customerId,
      contractId: contract.id,
      categoryId: "no_internet",
      answers: {
        affected_devices: "phone",
        connected_to_acessanet_wifi: "yes",
        can_open_any_site: "no",
        modem_lights: "normal",
        restarted_equipment: "yes_persists"
      }
    });

    if (!("diagnosisId" in diagnosis) || !diagnosis.diagnosisId) {
      throw new Error("Diagnosis did not produce an id");
    }

    await expect(
      service.createTicket({
        customerId: contract.customerId,
        contractId: contract.id,
        diagnosisId: diagnosis.diagnosisId,
        contactPhone: "11987654321"
      })
    ).rejects.toMatchObject({ code: "SGP_CHAMADO_REQUEST_FAILED" });

    expect(store.diagnoses.get(diagnosis.diagnosisId)).toBeDefined();

    const failedAudit = store.auditEvents.find((event) => event.type === "TICKET_CREATED" && event.metadata?.failed === true);
    expect(failedAudit).toBeDefined();
    expect(failedAudit?.metadata).toMatchObject({
      contractId: contract.id,
      diagnosisId: diagnosis.diagnosisId,
      errorCode: "SGP_CHAMADO_REQUEST_FAILED"
    });

    expect(store.findOpenTicketByContract(contract.id)).toBeUndefined();
  });

  it("rejeita uma segunda criacao concorrente pro mesmo contrato enquanto a primeira ainda esta em andamento", async () => {
    const store = new InMemoryStore();
    const contract = seedContract(store);

    let resolveCreateTicket!: (value: { sgpTicketId: string; protocol: string; rawStatus: string }) => void;
    const pendingCreateTicket = new Promise<{ sgpTicketId: string; protocol: string; rawStatus: string }>((resolve) => {
      resolveCreateTicket = resolve;
    });

    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn().mockReturnValue(pendingCreateTicket),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      listOccurrencesByContract: vi.fn().mockResolvedValue([])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, mockBillingProvider);

    const diagnosis = await service.diagnose({
      customerId: contract.customerId,
      contractId: contract.id,
      categoryId: "no_internet",
      answers: {
        affected_devices: "phone",
        connected_to_acessanet_wifi: "yes",
        can_open_any_site: "no",
        modem_lights: "normal",
        restarted_equipment: "yes_persists"
      }
    });

    if (!("diagnosisId" in diagnosis) || !diagnosis.diagnosisId) {
      throw new Error("Diagnosis did not produce an id");
    }

    const firstCall = service.createTicket({
      customerId: contract.customerId,
      contractId: contract.id,
      diagnosisId: diagnosis.diagnosisId,
      contactPhone: "11987654321"
    });

    const secondCall = service.createTicket({
      customerId: contract.customerId,
      contractId: contract.id,
      diagnosisId: diagnosis.diagnosisId,
      contactPhone: "11987654321"
    });

    await expect(secondCall).rejects.toMatchObject({ code: "DUPLICATE_TICKET_IN_PROGRESS" });

    resolveCreateTicket({ sgpTicketId: "sgp_race_winner", protocol: "238810", rawStatus: "aberto" });
    const ticket = await firstCall;
    expect(ticket.protocol).toBe("238810");
    expect(mockTicketProvider.createTicket).toHaveBeenCalledTimes(1);
  });
});

describe("SupportService.diagnose - lentidao com fatura em atraso", () => {
  function buildService(store: InMemoryStore, maxDaysLate: number | undefined) {
    const contract = seedContract(store);
    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn(),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      listOccurrencesByContract: vi.fn().mockResolvedValue([])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const overdueBillingProvider: BillingProvider = {
      getBillingSummary: vi.fn().mockResolvedValue({
        contractId: contract.id,
        status: maxDaysLate === undefined ? "PAID" : "OVERDUE",
        ...(maxDaysLate !== undefined ? { maxDaysLate } : {}),
        updatedAt: new Date().toISOString(),
        source: "sgp"
      }),
      listInvoices: vi.fn().mockResolvedValue({ contractId: contract.id, invoices: [], updatedAt: new Date().toISOString(), source: "sgp" }),
      requestPaymentPromise: vi.fn()
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, overdueBillingProvider);
    return { service, contract };
  }

  it("bloqueia e explica atraso de fatura quando o atraso e >= 5 dias", async () => {
    const store = new InMemoryStore();
    const { service, contract } = buildService(store, 5);

    const diagnosis = await service.diagnose({
      customerId: contract.customerId,
      contractId: contract.id,
      categoryId: "slow_internet",
      answers: {}
    });

    expect(diagnosis.state).toBe("BLOCKED");
    expect(diagnosis.classification).toBe("LENTIDAO_ATRASO_PAGAMENTO");
    expect(diagnosis.canOpenTicket).toBe(false);
    expect(diagnosis.customerMessage).toMatch(/atraso/i);
  });

  it("nao bloqueia por fatura quando o atraso e menor que 5 dias", async () => {
    const store = new InMemoryStore();
    const { service, contract } = buildService(store, 4);

    const diagnosis = await service.diagnose({
      customerId: contract.customerId,
      contractId: contract.id,
      categoryId: "slow_internet",
      answers: {}
    });

    expect(diagnosis.classification).not.toBe("LENTIDAO_ATRASO_PAGAMENTO");
  });

  it("nao bloqueia por fatura quando nao ha atraso", async () => {
    const store = new InMemoryStore();
    const { service, contract } = buildService(store, undefined);

    const diagnosis = await service.diagnose({
      customerId: contract.customerId,
      contractId: contract.id,
      categoryId: "slow_internet",
      answers: {}
    });

    expect(diagnosis.classification).not.toBe("LENTIDAO_ATRASO_PAGAMENTO");
  });
});

describe("SupportService - historico de chamados (fechados)", () => {
  function closedOccurrence(overrides: Record<string, unknown> = {}) {
    return {
      id: "sgp_1",
      protocol: "260928110100",
      contractId: "contract_lucas_home",
      status: "RESOLVED",
      createdAt: "2026-09-28T08:00:00.000Z",
      updatedAt: "2026-09-28T11:00:00.000Z",
      title: "Suporte Tecnico",
      raw: {
        numero: "260928110100",
        status: "Encerrada",
        data_cadastro: "2026-09-28",
        hora_cadastro: "08:00",
        tipo: "Suporte Tecnico",
        conteudo: "Chamado finalizado pois o teste foi concluido.",
        ...overrides
      }
    };
  }

  it("listTickets inclui chamados fechados, com o motivo de encerramento vindo do SGP", async () => {
    const store = new InMemoryStore();
    store.upsertCustomer({ id: "customer_lucas", name: "Lucas", cpf: "12345678909", phone: "11987654321" });
    // listTickets so busca ocorrencias no SGP para contratos com id numerico (formato real do SGP) -- por isso "5989" aqui, diferente do seedContract padrao.
    const contract = store.upsertContract({
      id: "5989",
      customerId: "customer_lucas",
      addressLine: "Rua XXXXXXXXX",
      city: "Franco da Rocha",
      state: "SP",
      planName: "800 Mega",
      status: "ACTIVE"
    });
    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn(),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      listOccurrencesByContract: vi.fn().mockResolvedValue([closedOccurrence()])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, mockBillingProvider);

    const tickets = await service.listTickets(contract.customerId);

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      protocol: "260928110100",
      statusInterno: "closed",
      closureReason: "Chamado finalizado pois o teste foi concluido."
    });
  });

  function isoDateDaysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  it("listTickets NAO mostra chamado fechado ha mais de 30 dias", async () => {
    const store = new InMemoryStore();
    store.upsertCustomer({ id: "customer_lucas", name: "Lucas", cpf: "12345678909", phone: "11987654321" });
    const contract = store.upsertContract({
      id: "5989",
      customerId: "customer_lucas",
      addressLine: "Rua XXXXXXXXX",
      city: "Franco da Rocha",
      state: "SP",
      planName: "800 Mega",
      status: "ACTIVE"
    });
    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn(),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      listOccurrencesByContract: vi
        .fn()
        .mockResolvedValue([closedOccurrence({ data_finalizacao: isoDateDaysAgo(40) })])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, mockBillingProvider);

    const tickets = await service.listTickets(contract.customerId);

    expect(tickets).toHaveLength(0);
  });

  it("listTickets mostra chamado fechado ha menos de 30 dias", async () => {
    const store = new InMemoryStore();
    store.upsertCustomer({ id: "customer_lucas", name: "Lucas", cpf: "12345678909", phone: "11987654321" });
    const contract = store.upsertContract({
      id: "5989",
      customerId: "customer_lucas",
      addressLine: "Rua XXXXXXXXX",
      city: "Franco da Rocha",
      state: "SP",
      planName: "800 Mega",
      status: "ACTIVE"
    });
    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn(),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      listOccurrencesByContract: vi
        .fn()
        .mockResolvedValue([closedOccurrence({ data_finalizacao: isoDateDaysAgo(5) })])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, mockBillingProvider);

    const tickets = await service.listTickets(contract.customerId);

    expect(tickets).toHaveLength(1);
  });

  it("listTickets mostra chamado ATIVO mesmo se foi aberto ha mais de 30 dias (corte de 30 dias so vale pra fechado)", async () => {
    const store = new InMemoryStore();
    store.upsertCustomer({ id: "customer_lucas", name: "Lucas", cpf: "12345678909", phone: "11987654321" });
    const contract = store.upsertContract({
      id: "5989",
      customerId: "customer_lucas",
      addressLine: "Rua XXXXXXXXX",
      city: "Franco da Rocha",
      state: "SP",
      planName: "800 Mega",
      status: "ACTIVE"
    });
    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn(),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      listOccurrencesByContract: vi.fn().mockResolvedValue([
        closedOccurrence({
          status: "Aberta",
          data_cadastro: isoDateDaysAgo(40),
          conteudo: "Descricao original do chamado, ainda aberto."
        })
      ])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, mockBillingProvider);

    const tickets = await service.listTickets(contract.customerId);

    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.statusInterno).not.toBe("closed");
  });

  it("getCurrentTicket reporta o chamado como fechado quando o SGP diz que fechou, mesmo com um registro local desatualizado", async () => {
    const store = new InMemoryStore();
    const contract = seedContract(store);

    // Ticket criado localmente pelo app -- o status local fica congelado em "RECEIVED" para sempre (nunca ha atualizacao automatica).
    store.createTicket({
      customerId: contract.customerId,
      contractId: contract.id,
      diagnosisId: "diag_1",
      sgpTicketId: "sgp_1",
      protocol: "260928110100",
      status: "RECEIVED",
      title: "Suporte Tecnico",
      description: "...",
      timeline: []
    });

    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn(),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      listOccurrencesByContract: vi.fn().mockResolvedValue([closedOccurrence()])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, mockBillingProvider);

    const current = await service.getCurrentTicket(contract.customerId, contract.id);

    expect(current.active).toBe(false);
    expect(current.ticket?.statusInterno).toBe("closed");
    expect((current.ticket as { closureReason?: string } | null)?.closureReason).toBe(
      "Chamado finalizado pois o teste foi concluido."
    );
  });

  it("mantem a hora real de abertura (do registro local) em vez da meia-noite que o SGP devolve (api so tem data, sem hora)", async () => {
    const store = new InMemoryStore();
    const contract = seedContract(store);

    const localTicket = store.createTicket({
      customerId: contract.customerId,
      contractId: contract.id,
      diagnosisId: "diag_1",
      sgpTicketId: "sgp_1",
      protocol: "260928110100",
      status: "RECEIVED",
      title: "Troca de senha do roteador",
      description: "...",
      timeline: []
    });

    // createdAt real tem hora (ex: 14:37) -- diferente de "00:00", que e o que a ocorrencia do SGP (sem hora_cadastro) geraria.
    expect(localTicket.createdAt.endsWith("T00:00:00.000Z")).toBe(false);

    const mockTicketProvider: TicketProvider = {
      createTicket: vi.fn(),
      getTicketStatus: vi.fn(),
      getTicketHistory: vi.fn(),
      listTicketsByContract: vi.fn().mockResolvedValue([]),
      // Ocorrencia do SGP sem hora_cadastro, como a API real devolve -- o mapper cai pra "00:00".
      listOccurrencesByContract: vi.fn().mockResolvedValue([closedOccurrence({ hora_cadastro: undefined })])
    };
    const mockNetworkProvider: NetworkProvider = {
      getConnectionStatus: vi.fn().mockResolvedValue(store.getConnection(contract.id))
    };
    const service = new SupportService(store, mockNetworkProvider, mockTicketProvider, mockAppointmentProvider, mockBillingProvider);

    const current = await service.getCurrentTicket(contract.customerId, contract.id);

    expect(current.ticket?.openedAt).toBe(localTicket.createdAt);
  });
});
