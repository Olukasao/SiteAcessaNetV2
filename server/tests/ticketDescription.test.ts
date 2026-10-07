import { describe, expect, it } from "vitest";
import { evaluateDiagnosis, CONTACT_PLACEHOLDER } from "../src/diagnosis/engine.js";
import type { ContractSummary, ConnectionStatus } from "../src/types.js";

const contract: ContractSummary = {
  id: "5989",
  customerId: "c1",
  addressLine: "Estrada do Alto, 83",
  city: "Franco da Rocha",
  state: "SP",
  planName: "Fibra 600 Mbps",
  status: "ACTIVE"
};

const connectionOnline: ConnectionStatus = {
  contractId: "5989",
  health: "NORMAL",
  contractStatus: "ACTIVE",
  onu: "ONLINE",
  pon: "ONLINE",
  pppoe: "ONLINE",
  opticalSignal: "NORMAL",
  knownIncident: false,
  updatedAt: new Date().toISOString()
};

const connectionOffline: ConnectionStatus = {
  ...connectionOnline,
  onu: "OFFLINE",
  pppoe: "OFFLINE",
  opticalSignal: "LOS",
  health: "CRITICAL"
};

describe("padrao de conteudo do chamado (DIAGNOSTICO APP ACESSANET)", () => {
  it("segue a estrutura fixa: cabecalho, titulo+prioridade, Cliente, Conexao, Solicitacao, Acao necessaria, Origem", () => {
    const result = evaluateDiagnosis({
      categoryId: "router_password",
      contract,
      connection: connectionOnline,
      answers: { router_password_new: "TESTE123@" }
    });

    const text = result.structuredDescription ?? "";
    expect(text.startsWith("DIAGNOSTICO APP ACESSANET")).toBe(true);
    expect(text).toMatch(/Troca de senha do roteador \| Prioridade: \w+/);
    expect(text).toContain("\nCliente\n");
    expect(text).toContain("\nConexao\n");
    expect(text).toContain("\nSolicitacao\n");
    expect(text).toContain("\nAcao necessaria\n");
    expect(text.trim().endsWith("Origem: Aplicativo Acessanet")).toBe(true);
  });

  it("deixa o placeholder de contato pronto para ser substituido pelo telefone", () => {
    const result = evaluateDiagnosis({
      categoryId: "router_password",
      contract,
      connection: connectionOnline,
      answers: { router_password_new: "TESTE123@" }
    });

    expect(result.structuredDescription).toContain(`Contato: ${CONTACT_PLACEHOLDER}`);
  });

  it("nao repete a mesma informacao em secoes diferentes (motivo/classificacao/hipotese nao aparecem mais como campos redundantes)", () => {
    const result = evaluateDiagnosis({
      categoryId: "router_password",
      contract,
      connection: connectionOnline,
      answers: { router_password_new: "TESTE123@" }
    });

    const text = result.structuredDescription ?? "";
    expect(text).not.toContain("Motivo informado:");
    expect(text).not.toContain("Classificacao preliminar:");
    expect(text).not.toContain("RESUMO OPERACIONAL");
    expect(text).not.toContain("EVIDENCIAS COLETADAS");
    expect(text).not.toContain("CHECKLIST SUGERIDO");
  });

  it("omite Plano/Endereco quando ausentes, e ONU/PON/PPPoE/Sinal quando desconhecidos -- nunca escreve 'Nao informado'/'N/A'", () => {
    const emptyContract: ContractSummary = { ...contract, planName: "", addressLine: "", city: "", state: "" };
    const unknownConnection: ConnectionStatus = {
      ...connectionOnline,
      onu: "UNKNOWN",
      pon: "UNKNOWN",
      pppoe: "UNKNOWN",
      opticalSignal: "UNKNOWN"
    };

    const result = evaluateDiagnosis({
      categoryId: "router_password",
      contract: emptyContract,
      connection: unknownConnection,
      answers: { router_password_new: "TESTE123@" }
    });

    const text = result.structuredDescription ?? "";
    expect(text).not.toContain("Plano:");
    expect(text).not.toContain("Endereco:");
    expect(text).not.toContain("ONU:");
    expect(text).not.toContain("PON:");
    expect(text).not.toContain("PPPoE:");
    expect(text).not.toContain("Sinal optico:");
    expect(text).not.toMatch(/Nao informado|N\/A|undefined|null/);
  });

  it("usa a prioridade/hipotese/acao corretas para FALHA_REDE_ACESSO (bug corrigido: antes caia no caso generico)", () => {
    const result = evaluateDiagnosis({
      categoryId: "no_internet",
      contract,
      connection: connectionOffline,
      answers: {}
    });

    const text = result.structuredDescription ?? "";
    expect(text).toContain("Prioridade: Alta");
    expect(text).toContain("Validar ONU, PPPoE, nivel optico, porta/OLT e necessidade de visita tecnica.");
  });

  it("preserva caracteres especiais e acentos sem escapar", () => {
    const description = 'Roteador com "clique" estranho às 23h — 50% de sinal & R$ 50,00 de prejuízo!!!';
    const result = evaluateDiagnosis({
      categoryId: "other",
      contract,
      connection: connectionOnline,
      answers: { other_problem_description: description }
    });

    expect(result.structuredDescription).toContain(description);
  });

  it("nunca inclui credenciais/tokens do sistema no texto do chamado", () => {
    const result = evaluateDiagnosis({
      categoryId: "router_password",
      contract,
      connection: connectionOnline,
      answers: { router_password_new: "TESTE123@" }
    });

    const text = result.structuredDescription ?? "";
    expect(text).not.toMatch(/SGP_|token|SMTP_PASS|JWT_SECRET/i);
  });
});
