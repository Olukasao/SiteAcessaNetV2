import type {
  BillingSummary,
  ConnectionStatus,
  ContractSummary,
  DiagnosisCategoryId,
  DiagnosisQuestion,
  DiagnosisResult,
  DiagnosisSummaryLine
} from "../types.js";
import { supportCategories } from "./categories.js";

export interface DiagnosisInput {
  categoryId: DiagnosisCategoryId;
  contract: ContractSummary;
  connection: ConnectionStatus;
  answers: Record<string, string>;
  duplicateTicketId?: string;
  billing?: BillingSummary;
}

/** A partir de quantos dias de atraso a lentidao reportada e atribuida a pendencia financeira em vez de investigacao tecnica. */
const SLOW_INTERNET_OVERDUE_THRESHOLD_DAYS = 5;

export function getFastDiagnosisQuestion(input: {
  categoryId: DiagnosisCategoryId;
  answers: Record<string, string>;
}): DiagnosisResult | undefined {
  if (input.categoryId === "router_password") {
    const password = normalizeRouterPassword(input.answers.router_password_new);
    const validationMessage = validateRouterPassword(password);

    if (!password || validationMessage) {
      return {
        state: "QUESTION",
        categoryId: input.categoryId,
        question: routerPasswordQuestion,
        classification: "TROCA_SENHA_ROTEADOR",
        customerMessage: validationMessage ?? "Digite a nova senha que deseja usar no Wi-Fi.",
        canOpenTicket: false
      };
    }

    return undefined;
  }

  if (input.categoryId === "other") {
    const description = normalizeFreeText(input.answers.other_problem_description);
    const validationMessage = validateOtherProblemDescription(description);

    if (!description || validationMessage) {
      return {
        state: "QUESTION",
        categoryId: input.categoryId,
        question: otherProblemQuestion,
        classification: "OUTRO_PROBLEMA",
        customerMessage: validationMessage ?? "Descreva o que esta acontecendo para direcionarmos melhor o atendimento.",
        canOpenTicket: false
      };
    }

    return undefined;
  }

  if (input.categoryId === "websites") {
    const url = normalizeFreeText(input.answers.website_url);
    const validationMessage = validateWebsiteUrl(url);

    if (!url || validationMessage) {
      return {
        state: "QUESTION",
        categoryId: input.categoryId,
        question: websiteUrlQuestion,
        classification: "SITES_APPS",
        customerMessage: validationMessage ?? "Informe o link do site que nao esta funcionando.",
        canOpenTicket: false
      };
    }
  }

  const flow = getFastQuestionFlow(input.categoryId);
  if (!flow) {
    return undefined;
  }

  const nextQuestion = firstMissingQuestion(input.answers, flow.questions);
  if (!nextQuestion) {
    return undefined;
  }

  return {
    state: "QUESTION",
    categoryId: input.categoryId,
    question: nextQuestion,
    classification: flow.classification,
    customerMessage: "Vamos entender melhor o que esta acontecendo.",
    canOpenTicket: false
  };
}

export function evaluateDiagnosis(input: DiagnosisInput): DiagnosisResult {
  const category = supportCategories.find((item) => item.id === input.categoryId);
  const baseSummary = buildTechnicalSummary(input.contract, input.connection);

  if (input.duplicateTicketId) {
    return {
      state: "BLOCKED",
      categoryId: input.categoryId,
      summary: baseSummary,
      classification: "CHAMADO_DUPLICADO",
      customerMessage: "Voce ja possui um chamado em andamento para esta assinatura.",
      canOpenTicket: false,
      duplicateTicketId: input.duplicateTicketId
    };
  }

  if (input.contract.status !== "ACTIVE" || input.connection.contractStatus !== "ACTIVE") {
    return {
      state: "BLOCKED",
      categoryId: input.categoryId,
      summary: baseSummary,
      classification: "CONTRATO_NAO_ATIVO",
      customerMessage: contractNotActiveMessage(input.contract.status),
      canOpenTicket: false
    };
  }

  if (input.categoryId === "router_password") {
    return evaluateRouterPassword(input, baseSummary);
  }

  if (input.connection.knownIncident) {
    return {
      state: "BLOCKED",
      categoryId: input.categoryId,
      summary: baseSummary,
      classification: "INCIDENTE_REGIONAL",
      customerMessage: "Ja estamos analisando seu chamado. Acompanhe em Meus chamados.",
      canOpenTicket: false
    };
  }

  if (input.categoryId === "no_internet") {
    return evaluateNoInternet(input, baseSummary);
  }

  if (input.categoryId === "slow_internet") {
    if (input.billing?.status === "OVERDUE" && (input.billing.maxDaysLate ?? 0) >= SLOW_INTERNET_OVERDUE_THRESHOLD_DAYS) {
      return {
        state: "BLOCKED",
        categoryId: input.categoryId,
        summary: baseSummary,
        classification: "LENTIDAO_ATRASO_PAGAMENTO",
        customerMessage:
          "Identificamos uma fatura em atraso ha mais de 5 dias. A lentidao pode estar relacionada a essa pendencia financeira -- regularize o pagamento em Faturas e a velocidade normaliza automaticamente. Se o problema continuar apos o pagamento, abra um chamado.",
        canOpenTicket: false
      };
    }

    return evaluateSequencedFlow(input, slowInternetQuestions, baseSummary, "LENTIDAO", category?.title ?? "Internet lenta");
  }

  if (input.categoryId === "intermittent") {
    return evaluateSequencedFlow(input, intermittentQuestions, baseSummary, "QUEDAS", category?.title ?? "Internet caindo");
  }

  if (input.categoryId === "wifi_problem") {
    return evaluateSequencedFlow(input, wifiProblemQuestions, baseSummary, "WIFI", category?.title ?? "Problema no Wi-Fi");
  }

  if (input.categoryId === "websites") {
    return evaluateWebsites(input, baseSummary, category?.title ?? "Alguns sites nao funcionam");
  }

  if (input.categoryId === "equipment") {
    return evaluateSequencedFlow(input, equipmentQuestions, baseSummary, "EQUIPAMENTO", category?.title ?? "Equipamento/modem");
  }

  if (input.categoryId === "phone") {
    return evaluateSequencedFlow(input, phoneQuestions, baseSummary, "TELEFONIA", category?.title ?? "Telefone");
  }

  if (input.categoryId === "other") {
    return evaluateOtherProblem(input, baseSummary);
  }

  return evaluateSequencedFlow(input, genericQuestions, baseSummary, "TRIAGEM_GERAL", category?.title ?? "Suporte");
}

function evaluateRouterPassword(input: DiagnosisInput, baseSummary: DiagnosisSummaryLine[]): DiagnosisResult {
  const password = normalizeRouterPassword(input.answers.router_password_new);
  const validationMessage = validateRouterPassword(password);

  if (!password || validationMessage) {
    return {
      state: "QUESTION",
      categoryId: input.categoryId,
      question: routerPasswordQuestion,
      summary: baseSummary,
      classification: "TROCA_SENHA_ROTEADOR",
      customerMessage: validationMessage ?? "Digite a nova senha que deseja usar no Wi-Fi.",
      canOpenTicket: false
    };
  }

  const summary = [
    ...baseSummary,
    { label: "Servico solicitado", value: "Troca de senha do Wi-Fi/roteador." },
    { label: "Nova senha solicitada", value: password },
    { label: "Resultado", value: "Solicitacao de configuracao enviada com a nova senha informada pelo cliente." },
    ...buildOperationalLines(input, "TROCA_SENHA_ROTEADOR")
  ];

  return {
    state: "SUMMARY",
    categoryId: input.categoryId,
    summary,
    classification: "TROCA_SENHA_ROTEADOR",
    customerMessage: "Vamos enviar a nova senha para a equipe tecnica realizar a alteracao.",
    canOpenTicket: true,
    structuredDescription: buildTicketDescription({
      title: "Troca de senha do roteador",
      classification: "TROCA_SENHA_ROTEADOR",
      contract: input.contract,
      connection: input.connection,
      requestLines: [`Nova senha Wi-Fi: ${password}`, "Status: Solicitacao enviada para configuracao."]
    })
  };
}

function evaluateOtherProblem(input: DiagnosisInput, baseSummary: DiagnosisSummaryLine[]): DiagnosisResult {
  const description = normalizeFreeText(input.answers.other_problem_description);
  const validationMessage = validateOtherProblemDescription(description);

  if (!description || validationMessage) {
    return {
      state: "QUESTION",
      categoryId: input.categoryId,
      question: otherProblemQuestion,
      summary: baseSummary,
      classification: "OUTRO_PROBLEMA",
      customerMessage: validationMessage ?? "Descreva o que esta acontecendo para direcionarmos melhor o atendimento.",
      canOpenTicket: false
    };
  }

  const summary = [
    ...baseSummary,
    { label: "Descricao do cliente", value: description },
    { label: "Resultado", value: "Solicitacao aberta a partir de descricao livre do cliente." },
    ...buildOperationalLines(input, "OUTRO_PROBLEMA")
  ];

  return {
    state: "SUMMARY",
    categoryId: input.categoryId,
    summary,
    classification: "OUTRO_PROBLEMA",
    customerMessage: "Vamos enviar sua descricao para a equipe analisar.",
    canOpenTicket: true,
    structuredDescription: buildTicketDescription({
      title: "Outro problema",
      classification: "OUTRO_PROBLEMA",
      contract: input.contract,
      connection: input.connection,
      requestLines: [description, "Status: Solicitacao aberta a partir de descricao livre do cliente."]
    })
  };
}

function evaluateWebsites(input: DiagnosisInput, baseSummary: DiagnosisSummaryLine[], title: string): DiagnosisResult {
  const url = normalizeFreeText(input.answers.website_url);
  const validationMessage = validateWebsiteUrl(url);

  if (!url || validationMessage) {
    return {
      state: "QUESTION",
      categoryId: input.categoryId,
      question: websiteUrlQuestion,
      summary: baseSummary,
      classification: "SITES_APPS",
      customerMessage: validationMessage ?? "Informe o link do site que nao esta funcionando.",
      canOpenTicket: false
    };
  }

  return evaluateSequencedFlow(input, websitesQuestions, baseSummary, "SITES_APPS", title);
}

function evaluateNoInternet(input: DiagnosisInput, baseSummary: DiagnosisSummaryLine[]): DiagnosisResult {
  const networkFailure =
    input.connection.onu === "OFFLINE" ||
    input.connection.pppoe === "OFFLINE" ||
    input.connection.opticalSignal === "LOS" ||
    input.connection.health === "CRITICAL";

  if (networkFailure) {
    const automaticOffline = isAutomaticOfflineDiagnosis(input.answers);
    const summary = [
      ...baseSummary,
      ...(automaticOffline ? buildAutomaticOfflineLines(input.answers) : []),
      { label: "Resultado", value: "Possivel falha de acesso ate o equipamento." },
      ...buildOperationalLines(input, "FALHA_REDE_ACESSO")
    ];

    const offlineOption = automaticOffline ? automaticOfflineOptionLabels[input.answers.offline_initial_option ?? ""] : undefined;
    const offlineDescription = automaticOffline ? normalizeFreeText(input.answers.offline_customer_description).slice(0, 500) : "";

    return {
      state: "SUMMARY",
      categoryId: input.categoryId,
      summary,
      classification: "FALHA_REDE_ACESSO",
      customerMessage: "Identificamos sinais de falha na conexao. Vamos abrir um chamado com esses dados tecnicos.",
      canOpenTicket: true,
      structuredDescription: buildTicketDescription({
        title: automaticOffline ? "Cliente offline" : "Sem internet",
        classification: "FALHA_REDE_ACESSO",
        contract: input.contract,
        connection: input.connection,
        requestLines: [
          ...(offlineOption ? [`Diagnostico inicial do cliente: ${offlineOption}`] : []),
          ...(offlineDescription ? [`Descricao do cliente: ${offlineDescription}`] : []),
          ...(!automaticOffline ? ["Cliente relata ausencia de conexao."] : []),
          "Status: Possivel falha de acesso ate o equipamento."
        ]
      })
    };
  }

  const allOnline =
    input.connection.onu === "ONLINE" &&
    input.connection.pppoe === "ONLINE" &&
    input.connection.opticalSignal === "NORMAL";

  if (allOnline) {
    const nextQuestion = firstMissingQuestion(input.answers, noInternetWifiQuestions);
    if (nextQuestion) {
      return {
        state: "QUESTION",
        categoryId: input.categoryId,
        question: nextQuestion,
        summary: baseSummary,
        classification: "REDE_EXTERNA_NORMAL",
        customerMessage:
          "Sua conexao parece chegar normalmente ate o equipamento. Vamos verificar agora a rede local.",
        canOpenTicket: false
      };
    }

    const answerSummary = summarizeAnswers(input.answers, noInternetWifiQuestions);
    const summary = [
      ...baseSummary,
      ...answerSummary,
      { label: "Classificacao preliminar", value: "Possivel problema de Wi-Fi/rede interna." },
      ...buildOperationalLines(input, "WIFI_OU_REDE_LOCAL")
    ];

    return {
      state: "SUMMARY",
      categoryId: input.categoryId,
      summary,
      classification: "WIFI_OU_REDE_LOCAL",
      customerMessage:
        "Identificamos que sua conexao esta chegando normalmente ate o equipamento. O chamado sera enviado com foco em Wi-Fi/rede local.",
      canOpenTicket: true,
      structuredDescription: buildTicketDescription({
        title: "Sem internet",
        classification: "WIFI_OU_REDE_LOCAL",
        contract: input.contract,
        connection: input.connection,
        requestLines: [
          ...answerSummary.map((line) => `${line.label}: ${line.value}`),
          "Status: Conexao chega normalmente ate o equipamento; foco em Wi-Fi/rede local."
        ]
      })
    };
  }

  const nextQuestion = firstMissingQuestion(input.answers, noInternetWifiQuestions);
  if (nextQuestion) {
    return {
      state: "QUESTION",
      categoryId: input.categoryId,
      question: nextQuestion,
      summary: baseSummary,
      classification: "DADOS_TECNICOS_INCONCLUSIVOS",
      customerMessage: "Vamos coletar mais algumas informacoes para abrir o chamado corretamente.",
      canOpenTicket: false
    };
  }

  const summary = [
    ...baseSummary,
    ...summarizeAnswers(input.answers, noInternetWifiQuestions),
    { label: "Resultado", value: "Diagnostico inconclusivo com dados tecnicos disponiveis." },
    ...buildOperationalLines(input, "DIAGNOSTICO_INCONCLUSIVO")
  ];

  return {
    state: "SUMMARY",
    categoryId: input.categoryId,
    summary,
    classification: "DIAGNOSTICO_INCONCLUSIVO",
    customerMessage: "Vamos abrir um chamado com as informacoes coletadas.",
    canOpenTicket: true,
    structuredDescription: buildTicketDescription({
      title: "Sem internet",
      classification: "DIAGNOSTICO_INCONCLUSIVO",
      contract: input.contract,
      connection: input.connection,
      requestLines: [
        ...summarizeAnswers(input.answers, noInternetWifiQuestions).map((line) => `${line.label}: ${line.value}`),
        "Status: Diagnostico inconclusivo com os dados tecnicos disponiveis."
      ]
    })
  };
}

function evaluateSequencedFlow(
  input: DiagnosisInput,
  questions: DiagnosisQuestion[],
  baseSummary: DiagnosisSummaryLine[],
  classification: string,
  title: string
): DiagnosisResult {
  const nextQuestion = firstMissingQuestion(input.answers, questions);
  if (nextQuestion) {
    return {
      state: "QUESTION",
      categoryId: input.categoryId,
      question: nextQuestion,
      summary: baseSummary,
      classification,
      customerMessage: "Vamos entender melhor o que esta acontecendo.",
      canOpenTicket: false
    };
  }

  const summary = [
    ...baseSummary,
    ...summarizeAnswers(input.answers, questions),
    { label: "Resultado", value: "Chamado enriquecido com triagem guiada." },
    ...buildOperationalLines(input, classification)
  ];

  return {
    state: "SUMMARY",
    categoryId: input.categoryId,
    summary,
    classification,
    customerMessage: "Ja temos informacoes suficientes para enviar o chamado.",
    canOpenTicket: true,
    structuredDescription: buildTicketDescription({
      title,
      classification,
      contract: input.contract,
      connection: input.connection,
      requestLines: [
        ...summarizeAnswers(input.answers, questions).map((line) => `${line.label}: ${line.value}`),
        "Status: Triagem guiada concluida."
      ]
    })
  };
}

function firstMissingQuestion(answers: Record<string, string>, questions: DiagnosisQuestion[]) {
  return questions.find((question) => !answers[question.id]);
}

function getFastQuestionFlow(categoryId: DiagnosisCategoryId) {
  if (categoryId === "slow_internet") {
    return {
      questions: slowInternetQuestions,
      classification: "LENTIDAO"
    };
  }

  if (categoryId === "intermittent") {
    return {
      questions: intermittentQuestions,
      classification: "QUEDAS"
    };
  }

  if (categoryId === "wifi_problem") {
    return {
      questions: wifiProblemQuestions,
      classification: "WIFI"
    };
  }

  if (categoryId === "websites") {
    return {
      questions: websitesQuestions,
      classification: "SITES_APPS"
    };
  }

  if (categoryId === "equipment") {
    return {
      questions: equipmentQuestions,
      classification: "EQUIPAMENTO"
    };
  }

  if (categoryId === "phone") {
    return {
      questions: phoneQuestions,
      classification: "TELEFONIA"
    };
  }

  if (categoryId !== "no_internet") {
    return {
      questions: genericQuestions,
      classification: "TRIAGEM_GERAL"
    };
  }

  return undefined;
}

function summarizeAnswers(answers: Record<string, string>, questions: DiagnosisQuestion[]) {
  return questions.map((question) => {
    const value = answers[question.id] ?? "Nao informado";
    const option = question.options.find((item) => item.value === value);
    return {
      label: question.text,
      value: option?.label ?? value
    };
  });
}

function buildTechnicalSummary(contract: ContractSummary, connection: ConnectionStatus): DiagnosisSummaryLine[] {
  const address = formatAddress(contract);

  return [
    { label: "Contrato", value: labelContractStatus(contract.status) },
    { label: "Contrato ID", value: contract.id },
    { label: "Plano", value: contract.planName || "Nao informado" },
    ...(address ? [{ label: "Endereco", value: address }] : []),
    { label: "Saude da conexao", value: labelConnectionHealth(connection.health) },
    { label: "ONU", value: labelTechnicalState(connection.onu) },
    { label: "PON", value: labelTechnicalState(connection.pon) },
    { label: "PPPoE", value: labelTechnicalState(connection.pppoe) },
    { label: "Sinal optico", value: labelOpticalSignal(connection.opticalSignal) },
    { label: "Incidente regional", value: connection.knownIncident ? "Sim" : "Nao" },
    { label: "Ultima leitura tecnica", value: formatDateTime(connection.updatedAt) }
  ];
}

/** Substituido pelo appendContactPhone (support/supportService.ts) assim que o telefone de contato e coletado -- o texto e montado aqui, antes de ter o telefone. */
export const CONTACT_PLACEHOLDER = "{{CONTATO}}";

/**
 * Formato padrao unico para o conteudo/descricao de TODO chamado aberto pelo
 * Aplicativo Acessanet (secao "REGRA PRINCIPAL" do padrao adotado em
 * 2026-09-28). So monta o TEXTO -- nao decide prioridade/classificacao
 * (isso continua em getTechnicalAdvisory, inalterado) nem fila/endpoint/SGP.
 */
function buildTicketDescription(input: {
  title: string;
  classification: string;
  contract: ContractSummary;
  connection: ConnectionStatus;
  requestLines: string[];
}) {
  const advisory = getTechnicalAdvisory(input.classification);
  const address = formatAddress(input.contract);

  const clienteLines = [
    `Contrato ${input.contract.id} - ${labelContractStatus(input.contract.status)}`,
    input.contract.planName ? `Plano: ${input.contract.planName}` : undefined,
    address ? `Endereco: ${address}` : undefined,
    `Contato: ${CONTACT_PLACEHOLDER}`
  ].filter((line): line is string => Boolean(line));

  const conexaoLines = buildConnectionLines(input.connection);

  const lines = [
    "DIAGNOSTICO APP ACESSANET",
    "",
    `${input.title} | Prioridade: ${advisory.priority}`,
    "",
    "Cliente",
    ...clienteLines,
    ...(conexaoLines.length > 0 ? ["", "Conexao", ...conexaoLines] : []),
    "",
    "Solicitacao",
    ...input.requestLines,
    "",
    "Acao necessaria",
    advisory.action,
    "",
    "Origem: Aplicativo Acessanet"
  ];

  return lines.join("\n").trim();
}

/** Omite ONU/PON/PPPoE/sinal optico quando o dado e desconhecido (UNKNOWN) -- nunca escrever "Nao informado"/"N/A" no chamado. */
function buildConnectionLines(connection: ConnectionStatus): string[] {
  const statePairs = [
    connection.onu !== "UNKNOWN" ? `ONU: ${labelTechnicalState(connection.onu)}` : undefined,
    connection.pon !== "UNKNOWN" ? `PON: ${labelTechnicalState(connection.pon)}` : undefined,
    connection.pppoe !== "UNKNOWN" ? `PPPoE: ${labelTechnicalState(connection.pppoe)}` : undefined
  ].filter((line): line is string => Boolean(line));

  const signalPairs = [
    connection.opticalSignal !== "UNKNOWN" ? `Sinal optico: ${labelOpticalSignal(connection.opticalSignal)}` : undefined,
    `Incidente regional: ${connection.knownIncident ? "Sim" : "Nao"}`
  ].filter((line): line is string => Boolean(line));

  return [
    ...(statePairs.length > 0 ? [statePairs.join(" | ")] : []),
    ...(signalPairs.length > 0 ? [signalPairs.join(" | ")] : []),
    `Ultima leitura: ${formatDateTime(connection.updatedAt)}`
  ];
}

function buildOperationalLines(input: DiagnosisInput, classification: string): DiagnosisSummaryLine[] {
  const advisory = getTechnicalAdvisory(classification, input);
  const symptom = deriveAnswerLabel(input.answers, [
    "wifi_problem_type",
    "website_problem_type",
    "equipment_problem_type",
    "phone_problem_type"
  ]);
  const impact = deriveImpact(input.answers);
  const period = deriveAnswerLabel(input.answers, ["time_period", "approximate_times", "started_when"]);
  const affectedService = deriveAnswerLabel(input.answers, ["affected_services"]);
  const customerCheck = deriveAnswerLabel(input.answers, [
    "wifi_restart",
    "equipment_restarted",
    "phone_restart",
    "equipment_power_checked",
    "website_error_type",
    "phone_device_connected",
    "phone_internet_working"
  ]);

  return [
    ...(symptom ? [{ label: "Sintoma principal", value: symptom }] : []),
    ...(impact ? [{ label: "Impacto informado", value: impact }] : []),
    ...(period ? [{ label: "Periodo informado", value: period }] : []),
    ...(affectedService ? [{ label: "Servico afetado", value: affectedService }] : []),
    ...(customerCheck ? [{ label: "Evidencia do cliente", value: customerCheck }] : []),
    { label: "Hipotese tecnica", value: advisory.hypothesis },
    { label: "Prioridade sugerida", value: advisory.priority },
    { label: "Acao sugerida", value: advisory.action }
  ];
}

const automaticOfflineOptionLabels: Record<string, string> = {
  red_light: "Luz vermelha no modem/ONU",
  no_red_light: "Nenhuma luz vermelha",
  equipment_off: "Modem/ONU esta apagado",
  lights_normal: "As luzes estao normais, mas continuo sem internet",
  unknown: "Nao sei identificar"
};

function isAutomaticOfflineDiagnosis(answers: Record<string, string>) {
  const optionId = answers.offline_initial_option;
  return Boolean(optionId && automaticOfflineOptionLabels[optionId]);
}

function buildAutomaticOfflineLines(answers: Record<string, string>): DiagnosisSummaryLine[] {
  const optionId = answers.offline_initial_option;
  const option = optionId ? automaticOfflineOptionLabels[optionId] : undefined;
  if (!option) {
    return [];
  }

  const description = normalizeFreeText(answers.offline_customer_description).slice(0, 500);

  return [
    { label: "Status detectado", value: "OFFLINE" },
    { label: "Diagnostico inicial do cliente", value: option },
    ...(description ? [{ label: "Descricao enviada pelo cliente", value: description }] : []),
    { label: "Data/hora da deteccao", value: formatDateTime(new Date().toISOString()) }
  ];
}

interface TechnicalAdvisory {
  hypothesis: string;
  priority: string;
  action: string;
  checklist: string[];
}

function getTechnicalAdvisory(classification: string, input?: DiagnosisInput): TechnicalAdvisory {
  const severeDrops = ["hourly", "unusable"].includes(input?.answers.drops_frequency ?? "");
  const criticalConnection =
    input?.connection.health === "CRITICAL" ||
    input?.connection.onu === "OFFLINE" ||
    input?.connection.pppoe === "OFFLINE" ||
    input?.connection.opticalSignal === "LOS";

  switch (classification) {
    case "FALHA_REDE_ACESSO":
      return {
        hypothesis: "Falha antes ou no equipamento do cliente, com sinal tecnico indicando queda de acesso.",
        priority: "Alta",
        action: "Validar ONU, PPPoE, nivel optico, porta/OLT e necessidade de visita tecnica.",
        checklist: [
          "Conferir status da ONU e autenticacao PPPoE no concentrador.",
          "Verificar nivel optico, LOS e historico de queda.",
          "Checar porta/OLT e eventos recentes na regiao.",
          "Acionar visita se o acesso remoto confirmar falha fisica."
        ]
      };
    case "WIFI_OU_REDE_LOCAL":
      return {
        hypothesis: "Acesso externo aparenta normalidade; maior chance de falha em Wi-Fi, roteador ou aparelho local.",
        priority: "Media",
        action: "Orientar validacao de Wi-Fi e, se necessario, testar por cabo antes de deslocamento.",
        checklist: [
          "Comparar teste por cabo e por Wi-Fi.",
          "Validar rede 2.4 GHz/5 GHz, distancia e interferencia.",
          "Checar se o problema ocorre em todos os aparelhos.",
          "Revisar roteador, canal e reinicio do equipamento."
        ]
      };
    case "LENTIDAO":
      return {
        hypothesis: criticalConnection
          ? "Lentidao com indicio tecnico de degradacao no acesso."
          : "Acesso online; investigar Wi-Fi, horario de pico, consumo local ou servicos especificos.",
        priority: criticalConnection ? "Alta" : "Media",
        action: "Comparar velocidade no cabo/Wi-Fi, verificar banda usada, consumo e degradacao no horario informado.",
        checklist: [
          "Solicitar ou conferir teste de velocidade por cabo.",
          "Validar banda Wi-Fi usada e distancia do roteador.",
          "Checar consumo simultaneo e equipamentos conectados.",
          "Conferir graficos de trafego e historico no horario informado."
        ]
      };
    case "QUEDAS":
      return {
        hypothesis: severeDrops || criticalConnection
          ? "Quedas recorrentes com impacto alto; possivel oscilacao de sinal, energia ou equipamento."
          : "Quedas intermitentes; necessario correlacionar horario, equipamento e sinal.",
        priority: severeDrops || criticalConnection ? "Alta" : "Media",
        action: "Analisar historico de desconexoes, energia do equipamento, nivel optico e eventos no horario relatado.",
        checklist: [
          "Conferir logs de queda PPPoE/ONU.",
          "Validar fonte de energia e reinicios do equipamento.",
          "Checar variacao de sinal optico.",
          "Correlacionar quedas com horario informado pelo cliente."
        ]
      };
    case "WIFI":
      return {
        hypothesis: "Sintoma concentrado na rede Wi-Fi, alcance, senha, banda ou comportamento do roteador.",
        priority: "Media",
        action: "Validar configuracao Wi-Fi, banda usada, alcance, quantidade de aparelhos e necessidade de ajuste no roteador.",
        checklist: [
          "Conferir se SSID aparece e se a senha esta correta.",
          "Validar teste proximo ao roteador e em outro comodo.",
          "Comparar 2.4 GHz e 5 GHz quando disponivel.",
          "Checar canal/interferencia e reinicio do roteador."
        ]
      };
    case "SITES_APPS":
      return {
        hypothesis: "Falha relatada em sites, apps ou servicos especificos; possivel DNS, rota, cache, dispositivo ou indisponibilidade externa.",
        priority: "Media",
        action: "Identificar servico afetado, tipo de erro e se ocorre em todos os aparelhos antes de tratar como falha de rede.",
        checklist: [
          "Testar o servico afetado em mais de um aparelho.",
          "Validar DNS, navegacao geral e rotas.",
          "Conferir se o problema ocorre somente no Wi-Fi ou tambem por cabo.",
          "Checar se ha indisponibilidade conhecida do servico externo."
        ]
      };
    case "EQUIPAMENTO":
      return {
        hypothesis: "Cliente relata comportamento fisico ou eletrico do equipamento/roteador/ONU.",
        priority: criticalConnection ? "Alta" : "Media",
        action: "Conferir energia, fonte, LEDs, reinicios, cabos e necessidade de troca ou visita tecnica.",
        checklist: [
          "Validar fonte, tomada e cabos conectados.",
          "Conferir LEDs do equipamento, principalmente LOS/PON.",
          "Checar historico de reinicios e temperatura.",
          "Avaliar troca de fonte/equipamento ou visita tecnica."
        ]
      };
    case "TELEFONIA":
      return {
        hypothesis: "Problema relatado no telefone fixo/VoIP, podendo envolver aparelho, cabo, porta FXS/ATA ou provisionamento.",
        priority: "Media",
        action: "Validar aparelho/cabo telefonico, porta de voz, registro VoIP e se a internet do contrato esta funcionando.",
        checklist: [
          "Confirmar se o telefone esta conectado na porta correta.",
          "Testar outro aparelho ou cabo telefonico quando possivel.",
          "Validar registro/provisionamento da telefonia.",
          "Checar se ha ruido, linha muda, falha para fazer/receber chamadas ou quedas."
        ]
      };
    case "INCIDENTE_REGIONAL":
      return {
        hypothesis: "Possivel incidente coletivo ou regional ja identificado.",
        priority: "Alta",
        action: "Manter tratativa pelo incidente regional e evitar duplicidade de chamado individual.",
        checklist: [
          "Confirmar abrangencia da falha.",
          "Atualizar previsao e comunicacao com clientes afetados.",
          "Vincular ocorrencias ao incidente principal."
        ]
      };
    case "CONTRATO_NAO_ATIVO":
      return {
        hypothesis: "Contrato ou acesso nao esta ativo para atendimento tecnico convencional.",
        priority: "Baixa",
        action: "Validar situacao cadastral/financeira antes de encaminhar para campo.",
        checklist: [
          "Conferir status do contrato no SGP.",
          "Validar pendencias de cadastro ou financeiro.",
          "Orientar regularizacao pelo canal adequado."
        ]
      };
    case "DIAGNOSTICO_INCONCLUSIVO":
      return {
        hypothesis: "Dados tecnicos e respostas nao apontam uma causa unica.",
        priority: "Media",
        action: "Fazer validacao remota inicial e contatar cliente para confirmar sintomas antes de visita.",
        checklist: [
          "Revalidar status ONU/PPPoE no momento do atendimento.",
          "Confirmar sintomas com o cliente.",
          "Executar testes remotos basicos.",
          "Encaminhar visita se a falha persistir sem causa remota clara."
        ]
      };
    case "TROCA_SENHA_ROTEADOR":
      return {
        hypothesis: "Cliente solicitou alteracao de senha do Wi-Fi/roteador.",
        priority: "Baixa",
        action: "Confirmar titularidade/contrato e aplicar a nova senha no equipamento gerenciado.",
        checklist: [
          "Confirmar contrato e titularidade antes da alteracao.",
          "Identificar o equipamento/roteador gerenciado do cliente.",
          "Aplicar a nova senha do Wi-Fi informada no chamado.",
          "Orientar o cliente a reconectar os aparelhos com a nova senha."
        ]
      };
    case "OUTRO_PROBLEMA":
      return {
        hypothesis: "Cliente descreveu uma situacao que nao se encaixa nas categorias padrao.",
        priority: "Media",
        action: "Ler a descricao do cliente, validar dados tecnicos do contrato e classificar o atendimento manualmente.",
        checklist: [
          "Ler a descricao completa enviada pelo cliente.",
          "Conferir status atual do contrato e da conexao.",
          "Contatar o cliente se faltar detalhe para classificar o problema.",
          "Encaminhar para suporte remoto ou visita conforme o sintoma informado."
        ]
      };
    default:
      return {
        hypothesis: "Triagem guiada coletou sintomas para direcionar o atendimento.",
        priority: criticalConnection ? "Alta" : "Media",
        action: "Usar as respostas do cliente e os dados tecnicos para definir teste remoto ou visita.",
        checklist: [
          "Conferir dados tecnicos atuais do contrato.",
          "Ler respostas do cliente antes do contato.",
          "Validar se ha chamado duplicado ou incidente regional.",
          "Registrar acao tomada no atendimento."
        ]
      };
  }
}

function deriveImpact(answers: Record<string, string>) {
  return deriveAnswerLabel(answers, [
    "affected_devices",
    "slow_all_devices",
    "wifi_affected_devices",
    "website_affected_devices",
    "impact"
  ]);
}

function deriveAnswerLabel(answers: Record<string, string>, ids: string[]) {
  for (const id of ids) {
    const value = answers[id];
    if (!value) {
      continue;
    }

    const question = allDiagnosisQuestions.find((item) => item.id === id);
    const option = question?.options.find((item) => item.value === value);
    return option?.label ?? value;
  }

  return undefined;
}

function formatAddress(contract: ContractSummary) {
  return [contract.addressLine, contract.city, contract.state].filter(Boolean).join(", ");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Nao informado";
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  });
}

function normalizeRouterPassword(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeFreeText(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function validateRouterPassword(value: string) {
  if (!value) {
    return undefined;
  }

  if (value.length < 8) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }

  if (value.length > 63) {
    return "A senha pode ter no maximo 63 caracteres.";
  }

  if (/[\r\n\t]/.test(value)) {
    return "A senha nao pode ter quebra de linha ou tabulacao.";
  }

  if (!/[A-Z]/.test(value)) {
    return "A senha precisa ter pelo menos uma letra maiuscula.";
  }

  if (!/[0-9]/.test(value)) {
    return "A senha precisa ter pelo menos um numero.";
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return "A senha precisa ter pelo menos um caractere especial.";
  }

  return undefined;
}

function validateOtherProblemDescription(value: string) {
  if (!value) {
    return undefined;
  }

  if (value.length < 10) {
    return "Descreva com pelo menos 10 caracteres.";
  }

  if (value.length > 500) {
    return "A descricao pode ter no maximo 500 caracteres.";
  }

  return undefined;
}

function validateWebsiteUrl(value: string) {
  if (!value) {
    return undefined;
  }

  if (value.length > 300) {
    return "O link informado e muito longo.";
  }

  if (!/^(https?:\/\/|www\.)/i.test(value)) {
    return "Informe um link valido, comecando com www., http:// ou https://.";
  }

  return undefined;
}

function labelContractStatus(status: string) {
  return status === "ACTIVE" ? "Ativo" : status;
}

/** Mensagem especifica por status -- nunca o generico "pendencia no contrato" pra quem simplesmente nao tem servico ativo. */
function contractNotActiveMessage(status: ContractSummary["status"]) {
  if (status === "CANCELED") {
    return "Este contrato está cancelado e não possui serviço de internet ativo.";
  }

  if (status === "SUSPENDED") {
    return "Este contrato está suspenso e não possui serviço de internet ativo no momento.";
  }

  return "Encontramos uma pendencia no contrato. Acesse os canais de atendimento para regularizar.";
}

function labelTechnicalState(status: string) {
  if (status === "ONLINE") {
    return "Online";
  }
  if (status === "OFFLINE") {
    return "Offline";
  }
  if (status === "DEGRADED") {
    return "Instavel";
  }
  return "Desconhecido";
}

function labelConnectionHealth(status: string) {
  if (status === "NORMAL") {
    return "Normal";
  }
  if (status === "WARNING") {
    return "Atencao";
  }
  if (status === "CRITICAL") {
    return "Critica";
  }
  return "Desconhecida";
}

function labelOpticalSignal(status: string) {
  if (status === "NORMAL") {
    return "Normal";
  }
  if (status === "WEAK") {
    return "Fraco";
  }
  if (status === "LOS") {
    return "Sem sinal/LOS";
  }
  return "Desconhecido";
}

const noInternetWifiQuestions: DiagnosisQuestion[] = [
  {
    id: "affected_devices",
    text: "O problema acontece em todos os aparelhos?",
    options: [
      { id: "all", label: "Sim", value: "all" },
      { id: "phone", label: "Somente celular", value: "phone" },
      { id: "computer", label: "Somente computador", value: "computer" },
      { id: "tv", label: "Somente TV", value: "tv" },
      { id: "one", label: "Apenas um aparelho", value: "one" }
    ]
  },
  {
    id: "connected_to_acessanet_wifi",
    text: "Voce esta conectado ao Wi-Fi da Acessanet?",
    options: [
      { id: "yes", label: "Sim", value: "yes" },
      { id: "no", label: "Nao", value: "no" },
      { id: "unknown", label: "Nao sei", value: "unknown" }
    ]
  },
  {
    id: "can_open_any_site",
    text: "Voce consegue abrir algum site?",
    options: [
      { id: "yes", label: "Sim", value: "yes" },
      { id: "no", label: "Nao", value: "no" },
      { id: "sometimes", label: "As vezes", value: "sometimes" }
    ]
  },
  {
    id: "modem_lights",
    text: "As luzes do modem estao acesas normalmente?",
    helperText: "Observe luz vermelha, LOS piscando ou equipamento sem energia.",
    options: [
      { id: "normal", label: "Normais", value: "normal" },
      { id: "red", label: "Luz vermelha ou LOS", value: "red" },
      { id: "off", label: "Equipamento apagado", value: "off" },
      { id: "unknown", label: "Nao sei", value: "unknown" }
    ]
  },
  {
    id: "restarted_equipment",
    text: "Voce ja reiniciou o equipamento?",
    options: [
      { id: "yes_persists", label: "Sim, problema continua", value: "yes_persists" },
      { id: "yes_solved", label: "Sim, resolveu", value: "yes_solved" },
      { id: "no", label: "Ainda nao", value: "no" }
    ]
  }
];

const slowInternetQuestions: DiagnosisQuestion[] = [
  {
    id: "slow_all_devices",
    text: "A lentidao acontece em todos os aparelhos?",
    options: [
      { id: "all", label: "Sim", value: "all" },
      { id: "some", label: "Somente alguns", value: "some" }
    ]
  },
  {
    id: "router_distance",
    text: "Voce esta perto do roteador?",
    options: [
      { id: "near", label: "Sim", value: "near" },
      { id: "far", label: "Nao", value: "far" }
    ]
  },
  {
    id: "wifi_band",
    text: "Esta conectado no Wi-Fi 2.4 GHz ou 5 GHz?",
    options: [
      { id: "2g", label: "2.4 GHz", value: "2g" },
      { id: "5g", label: "5 GHz", value: "5g" },
      { id: "unknown", label: "Nao sei", value: "unknown" }
    ]
  },
  {
    id: "time_period",
    text: "A lentidao acontece o tempo todo ou em determinados horarios?",
    options: [
      { id: "always", label: "Sempre", value: "always" },
      { id: "morning", label: "Manha", value: "morning" },
      { id: "afternoon", label: "Tarde", value: "afternoon" },
      { id: "night", label: "Noite", value: "night" },
      { id: "varies", label: "Varia", value: "varies" }
    ]
  },
  {
    id: "affected_services",
    text: "Em quais servicos percebe lentidao?",
    options: [
      { id: "browsing", label: "Navegacao", value: "browsing" },
      { id: "youtube", label: "YouTube", value: "youtube" },
      { id: "streaming", label: "Streaming", value: "streaming" },
      { id: "games", label: "Jogos", value: "games" },
      { id: "downloads", label: "Downloads", value: "downloads" },
      { id: "all", label: "Todos", value: "all" }
    ]
  }
];

const intermittentQuestions: DiagnosisQuestion[] = [
  {
    id: "drops_frequency",
    text: "Quantas vezes aproximadamente a conexao cai?",
    options: [
      { id: "daily", label: "1 vez por dia", value: "daily" },
      { id: "few", label: "Algumas vezes", value: "few" },
      { id: "hourly", label: "Varias vezes por hora", value: "hourly" },
      { id: "unusable", label: "Conexao praticamente inutilizavel", value: "unusable" }
    ]
  },
  {
    id: "approximate_times",
    text: "Em quais horarios costuma acontecer?",
    options: [
      { id: "morning", label: "Manha", value: "morning" },
      { id: "afternoon", label: "Tarde", value: "afternoon" },
      { id: "night", label: "Noite", value: "night" },
      { id: "random", label: "Sem horario fixo", value: "random" }
    ]
  },
  {
    id: "modem_restarts",
    text: "O modem reinicia ou apaga quando a conexao cai?",
    options: [
      { id: "yes", label: "Sim", value: "yes" },
      { id: "no", label: "Nao", value: "no" },
      { id: "unknown", label: "Nao sei", value: "unknown" }
    ]
  }
];

const wifiProblemQuestions: DiagnosisQuestion[] = [
  {
    id: "wifi_problem_type",
    text: "O que acontece no Wi-Fi?",
    options: [
      { id: "network_not_showing", label: "Rede nao aparece", value: "network_not_showing" },
      { id: "weak_signal", label: "Sinal fraco ou pouco alcance", value: "weak_signal" },
      { id: "password_error", label: "Senha incorreta", value: "password_error" },
      { id: "connects_no_internet", label: "Conecta, mas fica sem internet", value: "connects_no_internet" },
      { id: "wifi_drops", label: "Wi-Fi cai ou desconecta", value: "wifi_drops" }
    ]
  },
  {
    id: "wifi_affected_devices",
    text: "Acontece em quais aparelhos?",
    options: [
      { id: "all", label: "Todos", value: "all" },
      { id: "some", label: "Alguns", value: "some" },
      { id: "one", label: "Apenas um", value: "one" }
    ]
  },
  {
    id: "wifi_distance",
    text: "O problema acontece perto do roteador?",
    options: [
      { id: "near_too", label: "Sim, mesmo perto", value: "near_too" },
      { id: "far_only", label: "So longe do roteador", value: "far_only" },
      { id: "varies", label: "Varia conforme o local", value: "varies" },
      { id: "unknown", label: "Nao sei", value: "unknown" }
    ]
  },
  {
    id: "wifi_restart",
    text: "Ja reiniciou o roteador?",
    options: [
      { id: "yes_persists", label: "Sim, problema continua", value: "yes_persists" },
      { id: "yes_solved", label: "Sim, resolveu", value: "yes_solved" },
      { id: "no", label: "Ainda nao", value: "no" }
    ]
  }
];

const websiteUrlQuestion: DiagnosisQuestion = {
  id: "website_url",
  text: "Qual e o link do site que nao esta funcionando?",
  helperText: "Informe o endereco completo, comecando com www., http:// ou https:// (ex: https://www.exemplo.com.br).",
  inputType: "text",
  options: []
};

const websitesQuestions: DiagnosisQuestion[] = [
  websiteUrlQuestion,
  {
    id: "website_problem_type",
    text: "O problema acontece em qual tipo de servico?",
    options: [
      { id: "one_site", label: "Um site especifico", value: "one_site" },
      { id: "some_apps", label: "Alguns apps ou sites", value: "some_apps" },
      { id: "streaming", label: "Streaming/video", value: "streaming" },
      { id: "games", label: "Jogos", value: "games" },
      { id: "banking", label: "Banco ou app financeiro", value: "banking" }
    ]
  },
  {
    id: "website_error_type",
    text: "Qual erro aparece?",
    options: [
      { id: "not_load", label: "Nao carrega", value: "not_load" },
      { id: "slow_only", label: "Carrega muito lento", value: "slow_only" },
      { id: "dns_error", label: "Erro de DNS/servidor", value: "dns_error" },
      { id: "login_error", label: "Erro de login no site/app", value: "login_error" },
      { id: "unknown", label: "Nao sei informar", value: "unknown" }
    ]
  },
  {
    id: "website_affected_devices",
    text: "Acontece em todos os aparelhos?",
    options: [
      { id: "all", label: "Todos", value: "all" },
      { id: "some", label: "Alguns", value: "some" },
      { id: "one", label: "Apenas um", value: "one" }
    ]
  },
  {
    id: "website_connection_type",
    text: "Testou pelo Wi-Fi e pelo cabo?",
    options: [
      { id: "wifi_only", label: "So no Wi-Fi", value: "wifi_only" },
      { id: "cable_too", label: "Tambem no cabo", value: "cable_too" },
      { id: "not_tested", label: "Nao testei no cabo", value: "not_tested" },
      { id: "unknown", label: "Nao sei", value: "unknown" }
    ]
  }
];

const equipmentQuestions: DiagnosisQuestion[] = [
  {
    id: "equipment_problem_type",
    text: "O que acontece com o equipamento?",
    options: [
      { id: "no_power", label: "Apagado ou sem energia", value: "no_power" },
      { id: "red_los", label: "Luz vermelha ou LOS", value: "red_los" },
      { id: "rebooting", label: "Reiniciando sozinho", value: "rebooting" },
      { id: "overheating", label: "Esquentando muito", value: "overheating" },
      { id: "cable_damage", label: "Cabo ou fonte danificados", value: "cable_damage" }
    ]
  },
  {
    id: "equipment_power_checked",
    text: "Tomada, fonte e cabos foram conferidos?",
    options: [
      { id: "yes", label: "Sim", value: "yes" },
      { id: "no", label: "Ainda nao", value: "no" },
      { id: "not_possible", label: "Nao consigo verificar", value: "not_possible" }
    ]
  },
  {
    id: "equipment_lights",
    text: "Como estao as luzes do equipamento?",
    options: [
      { id: "normal", label: "Normais", value: "normal" },
      { id: "all_off", label: "Todas apagadas", value: "all_off" },
      { id: "red_or_los", label: "Vermelha/LOS", value: "red_or_los" },
      { id: "blinking", label: "Piscando diferente", value: "blinking" },
      { id: "unknown", label: "Nao sei", value: "unknown" }
    ]
  },
  {
    id: "equipment_restarted",
    text: "Ja reiniciou o equipamento?",
    options: [
      { id: "yes_persists", label: "Sim, problema continua", value: "yes_persists" },
      { id: "yes_solved", label: "Sim, resolveu", value: "yes_solved" },
      { id: "no", label: "Ainda nao", value: "no" }
    ]
  }
];

const phoneQuestions: DiagnosisQuestion[] = [
  {
    id: "phone_problem_type",
    text: "Qual problema acontece no telefone?",
    options: [
      { id: "no_line", label: "Sem linha ou mudo", value: "no_line" },
      { id: "cannot_call", label: "Nao faz chamada", value: "cannot_call" },
      { id: "cannot_receive", label: "Nao recebe chamada", value: "cannot_receive" },
      { id: "noise", label: "Chiado ou ruido", value: "noise" },
      { id: "call_drops", label: "Ligacao cai", value: "call_drops" }
    ]
  },
  {
    id: "phone_device_connected",
    text: "O telefone esta conectado no equipamento da internet?",
    helperText: "Normalmente o cabo do telefone fica ligado na porta TEL/Phone do equipamento.",
    options: [
      { id: "yes", label: "Sim", value: "yes" },
      { id: "no", label: "Nao", value: "no" },
      { id: "unknown", label: "Nao sei", value: "unknown" }
    ]
  },
  {
    id: "phone_internet_working",
    text: "A internet esta funcionando normalmente?",
    options: [
      { id: "yes", label: "Sim", value: "yes" },
      { id: "no", label: "Nao", value: "no" },
      { id: "unstable", label: "Esta instavel", value: "unstable" }
    ]
  },
  {
    id: "phone_restart",
    text: "Ja reiniciou o equipamento e o telefone?",
    options: [
      { id: "yes_persists", label: "Sim, problema continua", value: "yes_persists" },
      { id: "yes_solved", label: "Sim, resolveu", value: "yes_solved" },
      { id: "no", label: "Ainda nao", value: "no" }
    ]
  }
];

const genericQuestions: DiagnosisQuestion[] = [
  {
    id: "impact",
    text: "O problema afeta todos os aparelhos?",
    options: [
      { id: "all", label: "Todos", value: "all" },
      { id: "some", label: "Alguns", value: "some" },
      { id: "one", label: "Apenas um", value: "one" }
    ]
  },
  {
    id: "started_when",
    text: "Quando o problema comecou?",
    options: [
      { id: "today", label: "Hoje", value: "today" },
      { id: "days", label: "Ha alguns dias", value: "days" },
      { id: "weeks", label: "Ha semanas", value: "weeks" }
    ]
  }
];

const routerPasswordQuestion: DiagnosisQuestion = {
  id: "router_password_new",
  text: "Qual nova senha deseja usar no Wi-Fi?",
  helperText: "Use de 8 a 63 caracteres, com pelo menos 1 letra maiuscula, 1 numero e 1 caractere especial. Evite dados obvios, como telefone ou data de nascimento.",
  inputType: "password",
  options: []
};

const otherProblemQuestion: DiagnosisQuestion = {
  id: "other_problem_description",
  text: "O que esta acontecendo?",
  helperText: "Escreva os detalhes principais do problema para a equipe tecnica entender melhor.",
  inputType: "text",
  options: []
};

const allDiagnosisQuestions = [
  ...noInternetWifiQuestions,
  ...slowInternetQuestions,
  ...intermittentQuestions,
  ...wifiProblemQuestions,
  ...websitesQuestions,
  ...equipmentQuestions,
  ...phoneQuestions,
  ...genericQuestions,
  routerPasswordQuestion,
  otherProblemQuestion
];

export function describeDiagnosisAnswers(answers: Record<string, string>): DiagnosisSummaryLine[] {
  return Object.entries(answers)
    .map(([id, value]) => {
      const question = allDiagnosisQuestions.find((item) => item.id === id);
      const option = question?.options.find((item) => item.value === value);

      return {
        label: question?.text ?? id,
        value: option?.label ?? value
      };
    })
    .filter((line) => line.value.trim());
}
