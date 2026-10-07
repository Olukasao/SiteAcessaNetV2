import { describe, expect, it, vi } from "vitest";
import { extractConnectionStatus } from "../src/integrations/sgp/sgpMapper.js";
import { SgpBackedNetworkProvider, MockSgpNetworkProvider } from "../src/integrations/sgp/providers.js";
import type { SgpUraClient } from "../src/integrations/sgp/sgpClient.js";
import { InMemoryStore } from "../src/repositories/inMemoryStore.js";

describe("extractConnectionStatus", () => {
  it("reconhece o formato real de diagnostico 'DIAGNOSTICO: Cliente ONLINE' (com sinal optico junto)", () => {
    const status = extractConnectionStatus({
      conteudo: "DIAGNÓSTICO:Cliente ONLINE.porem  Sinal óptico elevado  RX ONU:-30,45 dBm"
    });
    expect(status).toBe("ONLINE");
  });

  it("reconhece 'DIAGNOSTICO: ONLINE' sem a palavra 'Cliente' (confirmado ao vivo, contrato 5989)", () => {
    const status = extractConnectionStatus({
      conteudo: "DIAGNOSTICO: ONLINE    PROXIMA AÇÃO: Terceiro contato, mas sem sucesso. Encerrado chamado."
    });
    expect(status).toBe("ONLINE");
  });

  it("reconhece 'DIAGNOSTICO: Cliente OFFLINE'", () => {
    const status = extractConnectionStatus({
      conteudo: "DIAGNOSTICO: Cliente OFFLINE    PROXIMA AÇÃO:  Enviar tecnico a campo"
    });
    expect(status).toBe("OFFLINE");
  });

  it("reconhece 'DIAGNOSTICO: Offline' sem a palavra 'Cliente'", () => {
    const status = extractConnectionStatus({
      conteudo: "DIAGNOSTICO: Offline e foi tratado por massivo  PROXIMA AÇÃO: Chamado sera encerrado"
    });
    expect(status).toBe("OFFLINE");
  });

  it("reconhece 'Status:LOSS'/'Ultimo Alarme:LOSS' (confirmado ao vivo em OS real, contrato 5989 -- 'LOSS' e palavra diferente de 'LOS' pro \\b do regex)", () => {
    const status = extractConnectionStatus({
      conteudo: "DIAGNOSTICO: Cliente OFFLINE\n\nStatus:LOSS\n\nUltimo Alarme:LOSS\n\nUltima Queda:09/02/2026"
    });
    expect(status).toBe("OFFLINE");
  });

  it("nao reconhece texto administrativo sem diagnostico tecnico (nota de troca de senha, financeiro, etc.)", () => {
    expect(extractConnectionStatus({ conteudo: "Realizado a troca da senha com sucesso." })).toBeUndefined();
    expect(
      extractConnectionStatus({ conteudo: "Validado em sistema, ja ocorreu a baixa da fatura." })
    ).toBeUndefined();
    expect(extractConnectionStatus({ conteudo: "TESTE" })).toBeUndefined();
  });

  /**
   * Gap real confirmado ao vivo em 2026-10-05 (contrato 5989): o proprio app
   * gera esse texto (DIAGNOSTICO APP ACESSANET, ver diagnosis/engine.ts
   * buildConnectionLines) quando o cliente faz autodiagnose, mas o extrator
   * nao reconhecia o proprio formato -- um diagnostico que o sistema mesmo
   * produziu ficava invisivel pra ele numa consulta seguinte.
   */
  it("reconhece o formato gerado pelo proprio app ('ONU: Online | PON: Online | PPPoE: Online')", () => {
    const status = extractConnectionStatus({
      conteudo:
        "DIAGNOSTICO APP ACESSANET\n\nConexao\nONU: Online | PON: Online | PPPoE: Online\nSinal optico: Normal | Incidente regional: Nao"
    });
    expect(status).toBe("ONLINE");
  });

  it("reconhece a variante OFFLINE do formato gerado pelo proprio app", () => {
    const status = extractConnectionStatus({
      conteudo: "DIAGNOSTICO APP ACESSANET\n\nConexao\nONU: Offline | PON: Offline | PPPoE: Offline"
    });
    expect(status).toBe("OFFLINE");
  });
});

describe("SgpBackedNetworkProvider.getConnectionStatus", () => {
  it("procura entre varias ocorrencias recentes ate achar uma com diagnostico reconhecivel (nao so a mais recente)", async () => {
    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([
        { conteudo: "Realizado a troca da senha com sucesso.", contrato_status: "Ativo" },
        { conteudo: "DIAGNÓSTICO:Cliente ONLINE.porem Sinal optico elevado", contrato_status: "Ativo" },
        { conteudo: "DIAGNOSTICO: Cliente Offline e foi tratado", contrato_status: "Ativo" }
      ])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("5989");

    expect(status?.onu).toBe("ONLINE");
    expect(status?.health).toBe("NORMAL");
  });

  it("contrato ATIVO sem nenhuma ocorrencia com diagnostico reconhecivel = UNKNOWN, nunca ONLINE nem null (Teste 6)", async () => {
    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([
        { conteudo: "TESTE", contrato_status: "Ativo" },
        { conteudo: "Cancelamento do Contrato", contrato_status: "Ativo" }
      ])
    } as unknown as SgpUraClient;

    const store = new InMemoryStore();
    const fallback = new MockSgpNetworkProvider(store);
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("3005");

    // Sem diagnostico reconhecivel em nenhuma ocorrencia e contrato ATIVO: nunca cair em
    // null/fallback (bug historico -- rota respondia 404, Central mostrava "Indisponivel" num
    // contrato saudavel, CPF 369.018.418-50 / contrato 27410) E nunca assumir ONLINE so por
    // ausencia de chamado (bug novo, confirmado 2026-10-05, contrato 19611/servico 18082: SGP
    // mostrava "1 Offline" mas a Central mostrava ONU/PON/PPPoE Online). UNKNOWN e o unico
    // resultado honesto quando nao ha nenhum sinal tecnico confiavel.
    expect(status).not.toBeNull();
    expect(status?.health).toBe("UNKNOWN");
    expect(status?.onu).toBe("UNKNOWN");
    expect(status?.pon).toBe("UNKNOWN");
    expect(status?.pppoe).toBe("UNKNOWN");
    expect(status?.contractStatus).toBe("ACTIVE");
    expect(status?.statusSource).toBe("NO_EVIDENCE");
  });

  it("contrato ATIVO sem NENHUMA ocorrencia (cliente nunca abriu chamado) = UNKNOWN, nunca null", async () => {
    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("27410");

    expect(status).not.toBeNull();
    expect(status?.health).toBe("UNKNOWN");
    expect(status?.onu).toBe("UNKNOWN");
    expect(status?.statusSource).toBe("NO_EVIDENCE");
  });

  it("contrato SUSPENSO sem diagnostico reconhecivel = CRITICAL/OFFLINE via status do contrato, nao UNKNOWN (Teste 3)", async () => {
    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([{ conteudo: "TESTE", contrato_status: "Suspenso" }])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("3005");

    // Suspensao/cancelamento do contrato continua sendo usado (diferente de "contrato ATIVO"):
    // e uma consequencia operacional real (corta acesso no AAA/Radius), nao um "nao sei".
    expect(status?.health).toBe("CRITICAL");
    expect(status?.contractStatus).toBe("SUSPENDED");
    expect(status?.onu).toBe("OFFLINE");
    expect(status?.statusSource).toBe("CONTRACT_STATUS");
  });

  /**
   * CASO REAL que motivou toda esta investigacao (2026-10-05): cliente 18139
   * SALETE MARIA SALDANHA, contrato 19611, servico de internet 18082. O
   * proprio SGP mostrava "Servicos: 0 Online / 1 Offline" pro cliente, mas a
   * Central exibia "ONU: Online | PON: Online | PPPoE: Online" -- porque, no
   * momento da consulta, nao havia NENHUM chamado recente/aberto com
   * diagnostico reconhecivel (o chamado 779169, aberto via telefone com
   * "Status do equipamento: Offline", so foi criado minutos depois). Este
   * teste reproduz a condicao REAL (chamado aberto, texto exatamente como
   * o tecnico Abraao Souza escreveu em producao) e trava o resultado correto.
   */
  it("regressao do caso real: contrato 19611/servico 18082 -- chamado aberto com 'Status do equipamento: Offline' = CRITICAL/OFFLINE (Teste 2)", async () => {
    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([
        {
          id: 779169,
          contrato: 19611,
          contrato_status: "Ativo",
          status: "Aberta",
          tipo: "FINANCEIRO",
          data_cadastro: new Date().toISOString().slice(0, 10),
          conteudo:
            "Nome do reclamante: SALETE MARIA SALDANHA\r\nStatus do equipamento: Offline\r\n\r\nDiagnóstico:sem conexão\r\n\r\nProxima ação: cliente esta offline porem tem pendencia financeira."
        }
      ])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("19611");

    expect(status?.contractStatus).toBe("ACTIVE");
    expect(status?.health).toBe("CRITICAL");
    expect(status?.onu).toBe("OFFLINE");
    expect(status?.pon).toBe("OFFLINE");
    expect(status?.pppoe).toBe("OFFLINE");
    expect(status?.statusSource).toBe("SGP_TICKET_DIAGNOSIS");
  });

  it("contrato ATIVO + diagnostico tecnico ONLINE reconhecivel = NORMAL/ONLINE com statusSource SGP_TICKET_DIAGNOSIS (Teste 1 e 5)", async () => {
    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([
        {
          contrato_status: "Ativo",
          status: "Encerrada",
          data_cadastro: new Date().toISOString().slice(0, 10),
          data_finalizacao: new Date().toISOString().slice(0, 10),
          conteudo: "DIAGNOSTICO: Cliente ONLINE"
        }
      ])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("19611");

    expect(status?.contractStatus).toBe("ACTIVE");
    expect(status?.health).toBe("NORMAL");
    expect(status?.onu).toBe("ONLINE");
    expect(status?.pppoe).toBe("ONLINE");
    expect(status?.statusSource).toBe("SGP_TICKET_DIAGNOSIS");
  });

  /**
   * Regressao do caso REAL que motivou a correcao original: CPF
   * 369.018.418-50, contrato 27410 (ATIVO, internet funcionando). 18
   * ocorrencias no SGP, TODAS encerradas; os unicos chamados com diagnostico
   * reconhecivel ("Cliente offline") eram antigos e corretamente descartados
   * por isDiagnosisStillRelevant. Historico dessa regressao:
   *   1. Original: devolvia null -> rota 404 -> "Indisponivel" com internet OK.
   *   2. Correcao de 2026-10-03: passou a devolver NORMAL/ONLINE -- resolvia
   *      o (1), mas introduzia o bug NOVO confirmado em 2026-10-05 (contrato
   *      19611/servico 18082: "contrato ativo sem chamado" != "online").
   *   3. Correcao atual (ver Teste 6 acima): UNKNOWN -- nunca 404, nunca
   *      ONLINE inventado.
   */
  it("contrato ativo com historico so de chamados antigos/encerrados = UNKNOWN (nunca ONLINE, nunca null)", async () => {
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
    const oldClosedOffline = {
      conteudo: "DIAGNOSTICO: Cliente offline",
      contrato_status: "Ativo",
      status: "Encerrada",
      data_cadastro: fiveMonthsAgo.toISOString().slice(0, 10),
      data_finalizacao: fiveMonthsAgo.toISOString().slice(0, 10)
    };
    const adminNote = { conteudo: "Envio de Fatura via Central App", contrato_status: "Ativo", status: "Encerrada" };

    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([adminNote, oldClosedOffline, adminNote])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("27410");

    expect(status).not.toBeNull();
    expect(status?.health).toBe("UNKNOWN");
    expect(status?.onu).toBe("UNKNOWN");
    expect(status?.contractStatus).toBe("ACTIVE");
    expect(status?.statusSource).toBe("NO_EVIDENCE");
  });

  /**
   * Regressao de caso real: contrato ATIVO cujo UNICO chamado com diagnostico
   * reconhecivel e um chamado ENCERRADO (resolvido) ha varios meses. Esse
   * texto antigo nunca deve ser usado como se refletisse o estado ATUAL da
   * conexao -- nem pra CRITICAL (bug antigo) nem pra NORMAL/ONLINE (bug
   * introduzido em 2026-10-03). Ver isDiagnosisStillRelevant em providers.ts.
   */
  it("NUNCA usa o diagnostico de um chamado ja ENCERRADO ha muito tempo como status atual (= UNKNOWN)", async () => {
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);

    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([
        {
          conteudo: "DIAGNOSTICO: Cliente offline",
          contrato_status: "Ativo",
          status: "Encerrada",
          data_cadastro: fiveMonthsAgo.toISOString().slice(0, 10),
          data_finalizacao: fiveMonthsAgo.toISOString().slice(0, 10)
        }
      ])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("27410");

    // Nenhum diagnostico confiavel -- nunca "CRITICAL" por um problema ja resolvido ha meses,
    // e nunca "NORMAL/ONLINE" inventado. UNKNOWN e o unico resultado honesto.
    expect(status?.health).toBe("UNKNOWN");
    expect(status?.statusSource).toBe("NO_EVIDENCE");
    expect(status?.onu).toBe("UNKNOWN");
  });

  it("confia no diagnostico de um chamado ainda ABERTO, mesmo criado ha muito tempo", async () => {
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);

    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([
        {
          conteudo: "DIAGNOSTICO: Cliente offline",
          contrato_status: "Ativo",
          status: "Em Atendimento",
          data_cadastro: fiveMonthsAgo.toISOString().slice(0, 10)
        }
      ])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("27410");

    expect(status?.health).toBe("CRITICAL");
    expect(status?.onu).toBe("OFFLINE");
  });

  it("confia no diagnostico de um chamado ENCERRADO recentemente (dentro da janela de validade)", async () => {
    const client = {
      listOccurrencesByContract: vi.fn().mockResolvedValue([
        {
          conteudo: "DIAGNOSTICO: Cliente ONLINE",
          contrato_status: "Ativo",
          status: "Encerrada",
          data_cadastro: new Date().toISOString().slice(0, 10),
          data_finalizacao: new Date().toISOString().slice(0, 10)
        }
      ])
    } as unknown as SgpUraClient;

    const fallback = new MockSgpNetworkProvider(new InMemoryStore());
    const provider = new SgpBackedNetworkProvider(fallback, client);

    const status = await provider.getConnectionStatus("27410");

    expect(status?.health).toBe("NORMAL");
    expect(status?.onu).toBe("ONLINE");
  });
});
