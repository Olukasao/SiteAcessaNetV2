import { describe, expect, it } from "vitest";
import { evaluateDiagnosis } from "../src/diagnosis/engine.js";
import type { ConnectionStatus, ContractSummary } from "../src/types.js";

function buildContract(status: ContractSummary["status"]): ContractSummary {
  return {
    id: "27410",
    customerId: "customer_sgp_test",
    addressLine: "Rua Teste, 1",
    city: "Cidade",
    state: "SP",
    planName: "Plano Teste",
    status
  };
}

function buildConnection(contractStatus: ConnectionStatus["contractStatus"]): ConnectionStatus {
  return {
    contractId: "27410",
    health: "CRITICAL",
    contractStatus,
    onu: "OFFLINE",
    pon: "OFFLINE",
    pppoe: "OFFLINE",
    opticalSignal: "LOS",
    knownIncident: false,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Mensagem exibida ao cliente quando o contrato selecionado nao esta ativo --
 * precisa ser especifica (cancelado/suspenso), nunca o generico "pendencia no
 * contrato" que nao explica o que de fato aconteceu.
 */
describe("evaluateDiagnosis (mensagem de contrato nao ativo)", () => {
  it("contrato CANCELADO: mensagem especifica, nunca abre chamado", () => {
    const result = evaluateDiagnosis({
      categoryId: "no_internet",
      contract: buildContract("CANCELED"),
      connection: buildConnection("CANCELED"),
      answers: {}
    });

    expect(result.state).toBe("BLOCKED");
    expect(result.canOpenTicket).toBe(false);
    expect(result.customerMessage).toBe("Este contrato está cancelado e não possui serviço de internet ativo.");
  });

  it("contrato SUSPENSO: mensagem especifica, nunca abre chamado", () => {
    const result = evaluateDiagnosis({
      categoryId: "no_internet",
      contract: buildContract("SUSPENDED"),
      connection: buildConnection("ACTIVE"),
      answers: {}
    });

    expect(result.state).toBe("BLOCKED");
    expect(result.canOpenTicket).toBe(false);
    expect(result.customerMessage).toBe("Este contrato está suspenso e não possui serviço de internet ativo no momento.");
  });

  it("contrato ATIVO: segue a triagem normalmente (nao bloqueia por status)", () => {
    const result = evaluateDiagnosis({
      categoryId: "no_internet",
      contract: buildContract("ACTIVE"),
      connection: buildConnection("ACTIVE"),
      answers: {}
    });

    expect(result.customerMessage).not.toContain("cancelado");
    expect(result.customerMessage).not.toContain("suspenso");
  });
});
