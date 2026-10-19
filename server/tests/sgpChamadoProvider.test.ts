import { describe, expect, it, vi } from "vitest";
import type { ContractSummary } from "../src/types.js";
import { SgpBackedTicketProvider, type TicketProvider } from "../src/integrations/sgp/providers.js";
import type { SgpUraClient } from "../src/integrations/sgp/sgpClient.js";
import { AppError } from "../src/errors.js";

function buildFallback(): TicketProvider {
  return {
    createTicket: vi.fn().mockResolvedValue({ sgpTicketId: "mock", protocol: "000000", rawStatus: "aberto" }),
    getTicketStatus: vi.fn(),
    getTicketHistory: vi.fn(),
    listTicketsByContract: vi.fn().mockResolvedValue([]),
    listOccurrencesByContract: vi.fn().mockResolvedValue([])
  };
}

const numericContract: ContractSummary = {
  id: "5989",
  customerId: "customer_test",
  addressLine: "Rua Local, 10",
  city: "Caieiras",
  state: "SP",
  planName: "Fibra Local",
  status: "ACTIVE"
};

const localContract: ContractSummary = { ...numericContract, id: "local_dev_contract" };

describe("SgpBackedTicketProvider.createTicket (POST /api/central/chamado/)", () => {
  it("envia o ocorrenciatipo/motivoos mapeado e a descricao completa da triagem para o SGP", async () => {
    const createCentralChamado = vi.fn().mockResolvedValue({ sgpTicketId: "sgp_1", protocol: "238900", rawStatus: "aberto", raw: {} });
    const client = { createCentralChamado } as unknown as SgpUraClient;
    const provider = new SgpBackedTicketProvider(buildFallback(), client, {
      app: "noc",
      token: "test-token",
      timeoutMs: 15000,
      semOs: undefined,
      mapping: { FALHA_REDE_ACESSO: { ocorrenciaTipo: "3", motivoOs: "12" } }
    });

    const result = await provider.createTicket({
      contract: numericContract,
      categoryTitle: "Sem internet",
      description: "DIAGNOSTICO...\n...transcricao completa da triagem...",
      classification: "FALHA_REDE_ACESSO",
      contactPhone: "11987654321",
      customerName: "Lucas"
    });

    expect(result).toEqual({ sgpTicketId: "sgp_1", protocol: "238900", rawStatus: "aberto" });
    expect(createCentralChamado).toHaveBeenCalledWith({
      contrato: "5989",
      conteudo: "DIAGNOSTICO...\n...transcricao completa da triagem...",
      contato: "Lucas",
      contatoNumero: "11987654321",
      ocorrenciaTipo: "3",
      motivoOs: "12",
      semOs: undefined
    });
  });

  it("falha explicitamente em vez de adivinhar um id quando a classificacao nao tem mapeamento", async () => {
    const createCentralChamado = vi.fn();
    const client = { createCentralChamado } as unknown as SgpUraClient;
    const provider = new SgpBackedTicketProvider(buildFallback(), client, {
      app: "noc",
      token: "test-token",
      timeoutMs: 15000,
      semOs: undefined,
      mapping: {}
    });

    await expect(
      provider.createTicket({
        contract: numericContract,
        categoryTitle: "Sem internet",
        description: "...",
        classification: "FALHA_REDE_ACESSO",
        contactPhone: "11987654321"
      })
    ).rejects.toMatchObject({ code: "SGP_CHAMADO_MAPPING_MISSING" });

    expect(createCentralChamado).not.toHaveBeenCalled();
  });

  it("delega pro fallback quando o contrato nao e um id numerico do SGP, sem chamar o SGP", async () => {
    const createCentralChamado = vi.fn();
    const client = { createCentralChamado } as unknown as SgpUraClient;
    const fallback = buildFallback();
    const provider = new SgpBackedTicketProvider(fallback, client, {
      app: "noc",
      token: "test-token",
      timeoutMs: 15000,
      semOs: undefined,
      mapping: { FALHA_REDE_ACESSO: { ocorrenciaTipo: "3", motivoOs: "12" } }
    });

    const result = await provider.createTicket({
      contract: localContract,
      categoryTitle: "Sem internet",
      description: "...",
      classification: "FALHA_REDE_ACESSO",
      contactPhone: "11987654321"
    });

    expect(result.protocol).toBe("000000");
    expect(createCentralChamado).not.toHaveBeenCalled();
    expect(fallback.createTicket).toHaveBeenCalledTimes(1);
  });

  it("propaga um AppError limpo quando a chamada ao SGP falha", async () => {
    const createCentralChamado = vi
      .fn()
      .mockRejectedValue(new AppError(502, "SGP_CHAMADO_REQUEST_FAILED", "Nao foi possivel abrir o chamado no SGP agora."));
    const client = { createCentralChamado } as unknown as SgpUraClient;
    const provider = new SgpBackedTicketProvider(buildFallback(), client, {
      app: "noc",
      token: "test-token",
      timeoutMs: 15000,
      semOs: undefined,
      mapping: { FALHA_REDE_ACESSO: { ocorrenciaTipo: "3", motivoOs: "12" } }
    });

    await expect(
      provider.createTicket({
        contract: numericContract,
        categoryTitle: "Sem internet",
        description: "...",
        classification: "FALHA_REDE_ACESSO",
        contactPhone: "11987654321"
      })
    ).rejects.toMatchObject({ code: "SGP_CHAMADO_REQUEST_FAILED" });
  });
});
