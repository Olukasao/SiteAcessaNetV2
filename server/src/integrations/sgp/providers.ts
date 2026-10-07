import type {
  Appointment,
  BillingInvoice,
  BillingInvoiceList,
  BillingSummary,
  ConnectionStatus,
  ContractSummary,
  TicketStatus,
  TicketSummary,
  TicketTimelineEvent
} from "../../types.js";
import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors.js";
import type { InMemoryStore } from "../../repositories/inMemoryStore.js";
import { randomId } from "../../security/hash.js";
import type { SgpContractRaw, SgpInvoiceRaw, SgpOccurrenceRaw, SgpUraClient } from "./sgpClient.js";
import { mapSgpStatus } from "./statusMapper.js";
import { mapSgpOccurrence, extractConnectionStatus } from "./sgpMapper.js";
import { mapSgpSignatureStatus, getSignatureStatusLabel, type SignatureStatus } from "./signatureStatusMapper.js";

export interface TicketSummaryWithRaw extends TicketSummary {
  raw: SgpOccurrenceRaw;
}

export interface ContractProvider {
  getContracts(customerId: string): Promise<ContractSummary[]>;
  getContract(contractId: string): Promise<ContractSummary | null>;
}

export interface NetworkProvider {
  getConnectionStatus(contractId: string): Promise<ConnectionStatus | null>;
}

export interface TicketProvider {
  createTicket(input: {
    contract: ContractSummary;
    categoryTitle: string;
    description: string;
    classification: string;
    contactPhone: string;
    customerName?: string | undefined;
  }): Promise<{ sgpTicketId: string; protocol: string; rawStatus: string }>;
  getTicketStatus(sgpTicketId: string): Promise<TicketStatus>;
  getTicketHistory(sgpTicketId: string): Promise<TicketTimelineEvent[]>;
  listTicketsByContract(contractId: string): Promise<TicketSummary[]>;
  listOccurrencesByContract(contractId: string): Promise<TicketSummary[]>;
}

export interface AppointmentProvider {
  getAppointment(ticketId: string): Promise<Appointment | null>;
}

export interface PaymentPromiseResult {
  released: boolean;
  protocol: string;
  releasedDays: number | undefined;
  message: string;
  raw: Record<string, unknown>;
}

export interface BillingProvider {
  getBillingSummary(contract: ContractSummary): Promise<BillingSummary>;
  listInvoices(contract: ContractSummary): Promise<BillingInvoiceList>;
  requestPaymentPromise(contract: ContractSummary): Promise<PaymentPromiseResult>;
}

export interface Signature {
  id: string;
  contractId: string;
  title: string;
  status: SignatureStatus;
  statusLabel: string;
  createdAt: string | undefined;
  signedAt: string | undefined;
  signUrl: string | undefined;
  documentUrl: string | undefined;
  /**
   * Chave de 6 digitos usada no proprio fluxo de assinatura do SGP (variavel
   * de notificacao {chave_assinatura}, confirmada na doc oficial -- ver
   * comentario em SgpBackedSignatureProvider). Opcional porque ainda nao
   * sabemos se a API real devolve isso junto da lista ou so por SMS/e-mail.
   */
  signKey: string | undefined;
}

/**
 * "source" distingue "perguntei ao SGP e a resposta foi vazia" (sgp/mock) de
 * "nao consegui perguntar" (unavailable) -- o frontend NUNCA deve mostrar
 * "voce nao possui assinaturas" quando source === "unavailable", so quando a
 * fonte e real. Mesmo padrao de BillingInvoiceList.source.
 */
export interface SignatureList {
  signatures: Signature[];
  source: "sgp" | "mock" | "unavailable";
}

export interface SignatureProvider {
  listSignatures(contract: ContractSummary): Promise<SignatureList>;
}

export class MockSgpContractProvider implements ContractProvider {
  constructor(private readonly store: InMemoryStore) {}

  async getContracts(customerId: string) {
    return this.store.listContracts(customerId);
  }

  async getContract(contractId: string) {
    return this.store.getContract(contractId) ?? null;
  }
}

export class MockSgpNetworkProvider implements NetworkProvider {
  constructor(private readonly store: InMemoryStore) {}

  async getConnectionStatus(contractId: string): Promise<ConnectionStatus | null> {
    return this.store.getConnection(contractId) ?? null;
  }
}

export class MockSgpTicketProvider implements TicketProvider {
  constructor(private readonly store: InMemoryStore) {}

  async createTicket() {
    return {
      sgpTicketId: randomId("sgp"),
      protocol: String(Math.floor(238742 + Math.random() * 1000)),
      rawStatus: "aberto"
    };
  }

  async getTicketStatus() {
    return mapSgpStatus("aberto");
  }

  async getTicketHistory() {
    return [];
  }

  async listTicketsByContract(contractId: string) {
    const all = Array.from(this.store.tickets.values());
    return all
      .filter((ticket) => ticket.contractId === contractId)
      .map((ticket) => ({
        id: ticket.id,
        protocol: ticket.protocol,
        contractId: ticket.contractId,
        status: ticket.status,
        title: ticket.title,
        description: ticket.description,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        ...(ticket.appointment ? { appointment: ticket.appointment } : {})
      }));
  }

  async listOccurrencesByContract(_contractId: string) {
    return [];
  }
}

/** So devolve o agendamento que a propria criacao do chamado sintetizou localmente (ver support/supportService.ts createAppointment) -- sem consulta de OS agendada no SGP, fora de escopo por enquanto. */
export class LocalAppointmentProvider implements AppointmentProvider {
  constructor(private readonly store: InMemoryStore) {}

  async getAppointment(ticketId: string) {
    const ticket = this.store.tickets.get(ticketId);
    return ticket?.appointment ?? null;
  }
}

export class MockSgpBillingProvider implements BillingProvider {
  async getBillingSummary(contract: ContractSummary): Promise<BillingSummary> {
    return {
      contractId: contract.id,
      status: "UNKNOWN",
      updatedAt: new Date().toISOString(),
      source: "mock"
    };
  }

  async listInvoices(contract: ContractSummary): Promise<BillingInvoiceList> {
    return {
      contractId: contract.id,
      invoices: [],
      updatedAt: new Date().toISOString(),
      source: "mock"
    };
  }

  /** Nunca usado em producao (SgpBackedBillingProvider sempre assume quando o SGP esta configurado, e esse backend nao sobe sem SGP) -- lanca em vez de simular sucesso, por ser uma acao real com efeito no SGP. */
  async requestPaymentPromise(_contract: ContractSummary): Promise<PaymentPromiseResult> {
    throw new AppError(501, "SGP_NOT_CONFIGURED", "Integracao com o SGP nao configurada.");
  }
}

export class SgpBackedBillingProvider implements BillingProvider {
  constructor(
    private readonly fallback: BillingProvider,
    private readonly client: SgpUraClient
  ) {}

  async getBillingSummary(contract: ContractSummary): Promise<BillingSummary> {
    if (!isLikelySgpContractId(contract.id)) {
      return this.fallback.getBillingSummary(contract);
    }

    try {
      const contracts = await this.client.consultCustomerByContract(contract.id);
      const raw = findContract(contracts, contract.id);
      if (!raw) {
        return unavailableBillingSummary(contract.id);
      }

      const summary = buildBillingSummaryFromSgp(contract.id, raw);
      const invoices = await this.listInvoices(contract);
      const maxDaysLate = getMaxDaysLate(invoices.invoices);

      return {
        ...summary,
        ...(maxDaysLate > 0 ? { maxDaysLate } : {})
      };
    } catch {
      return unavailableBillingSummary(contract.id);
    }
  }

  async listInvoices(contract: ContractSummary): Promise<BillingInvoiceList> {
    if (!isLikelySgpContractId(contract.id)) {
      return this.fallback.listInvoices(contract);
    }

    try {
      const rawInvoices = await this.client.listInvoicesByContract(contract.id);
      const invoices = rawInvoices
        .filter((invoice) => belongsToContract(invoice, contract.id))
        .map(mapSgpInvoice)
        .filter((invoice): invoice is BillingInvoice => Boolean(invoice))
        .sort((left, right) => String(right.dueDate ?? "").localeCompare(String(left.dueDate ?? "")));

      return {
        contractId: contract.id,
        invoices,
        updatedAt: new Date().toISOString(),
        source: "sgp"
      };
    } catch {
      return {
        contractId: contract.id,
        invoices: [],
        updatedAt: new Date().toISOString(),
        source: "unavailable"
      };
    }
  }

  /**
   * Diferente de getBillingSummary/listInvoices acima: NAO engole erro num catch devolvendo
   * um resultado "vazio" -- essa e uma acao real, que muda estado no SGP. Deixar o erro de
   * transporte (AppError SGP_REQUEST_FAILED) subir intacto pro service/rota decidir a
   * mensagem certa (seção 12 do pedido: "SGP indisponivel" != "contrato nao elegivel",
   * nunca confundir as duas).
   */
  async requestPaymentPromise(contract: ContractSummary): Promise<PaymentPromiseResult> {
    if (!isLikelySgpContractId(contract.id)) {
      return this.fallback.requestPaymentPromise(contract);
    }

    return this.client.requestPaymentPromise(contract.id);
  }
}

/** Default sempre que a integracao real de assinaturas nao esta pronta/ligada -- nunca finge "sem pendencias". */
export class UnavailableSignatureProvider implements SignatureProvider {
  async listSignatures(_contract: ContractSummary): Promise<SignatureList> {
    return { signatures: [], source: "unavailable" };
  }
}

/** So instanciado quando config.sgpSignMock.enabled (sempre false em producao) -- fixture fixa pra construir/testar a UI antes do endpoint real existir. */
export class MockSignatureProvider implements SignatureProvider {
  async listSignatures(contract: ContractSummary): Promise<SignatureList> {
    return {
      source: "mock",
      signatures: [
        {
          id: "mock-1",
          contractId: contract.id,
          title: "Contrato de Prestação de Serviço",
          status: "pending",
          statusLabel: getSignatureStatusLabel("pending"),
          createdAt: new Date().toISOString(),
          signedAt: undefined,
          /** about:blank de proposito -- mock nunca deve abrir um link que pareca uma URL real do SGP (endpoint ainda nao confirmado). */
          signUrl: "about:blank",
          documentUrl: undefined,
          signKey: "123456"
        }
      ]
    };
  }
}

/**
 * Decorator no mesmo molde de SgpBackedBillingProvider: tenta, qualquer erro
 * (incluindo "endpoint ainda nao confirmado") cai no catch e devolve
 * source:"unavailable" -- nunca propaga erro cru pro cliente, nunca finge
 * "sem pendencias". PONTO DE INTEGRACAO REAL: quando o endpoint do SGP for
 * confirmado, implementar SgpUraClient.listSignaturesByContract (hoje
 * inexistente) e chama-lo aqui no lugar do erro fixo abaixo.
 *
 * O QUE JA FOI CONFIRMADO (2026-10-02, via documentacao funcional do SGP/app
 * oficial TSMX Cliente -- NAO e referencia REST, so comportamento):
 * - O recurso se chama "SGPSign" e e nativo do SGP, nao e invencao nossa.
 * - Fluxo de assinatura do cliente: ele recebe um LINK + uma CHAVE de 6
 *   digitos; a chave e inserida no proprio fluxo de assinatura do SGP (fora
 *   do nosso backend) -- nao confundir com um campo que precisamos expor na
 *   nossa API, a nao ser que a API real devolva essa chave separada do
 *   link (a confirmar).
 * - Depois de assinado, o documento pode ficar "aguardando aprovacao de um
 *   colaborador" antes de ser considerado definitivo -- e exatamente o que
 *   o status interno "awaiting_validation" (signatureStatusMapper.ts) ja
 *   cobre, so falta confirmar a string crua que o SGP usa pra esse estado.
 * - Existem flags de configuracao no PAINEL DO SGP (nao em env var nossa):
 *   CENTRAL_ASSINATURA_ATIVA (habilita o cliente assinar pela Central do
 *   Assinante) e CENTRAL_ASSINATURA_DOCX (assinatura de contrato em DOCX).
 *   Pre-requisito no SGP antes de qualquer endpoint responder algo util --
 *   confirmar que estao ligadas no SGP admin antes de testar a integracao
 *   real.
 * - O app oficial TSMX Cliente tem uma area "Assinaturas" com fluxo
 *   Assinaturas -> Finalizadas -> documento -> "Ver Documento Assinado",
 *   confirmando que o ecossistema SGP/TSMX tem backend capaz de listar
 *   documentos por contrato e devolver o documento final -- mas isso ainda
 *   nao e a referencia REST (path/verbo/payload) que falta pra implementar
 *   SgpUraClient.listSignaturesByContract de verdade.
 *
 * ATUALIZACAO (2026-10-02, apos checar wiki.sgp.net.br e bookstack.sgp.net.br
 * -- ver relatorio completo entregue ao usuario na mesma data): a
 * documentacao PUBLICA do SGP nao expoe nenhum endpoint REST de assinatura
 * (o livro "API" no bookstack so documenta autenticacao e "Integracao
 * Gateway Generica", nenhuma pagina de assinatura/contrato/documento).
 * Ainda assim, confirmou-se vocabulario REAL do SGP (nomes de variavel de
 * notificacao SMS/e-mail, pagina "tabela_variaveis"), usado como melhor
 * candidato de nome de campo em mapRawSignature abaixo -- NAO e garantia de
 * que a API REST (quando descoberta) use os mesmos nomes de campo JSON:
 *   {pessoa_nome} {tipo_documento} {contrato_numero} {url_assinatura}
 *   {chave_assinatura} {data_assinatura} {url_documento_assinado}
 * Confirmaram-se tambem os 5 status exibidos no relatorio "Assinatura
 * Eletronica" (pagina "relatorios_assinatura_eletronica", texto de UI, NAO
 * confirmado como string crua de API): "Em processamento", "Assinado
 * aguardando validacao", "Assinado", "Finalizado", "Cancelado" -- ja
 * adicionados em signatureStatusMapper.ts.
 * PROXIMO PASSO (nao automatizavel sem acesso ao SGP real): abrir o SGP em
 * Relatorios -> Contrato -> Assinatura Eletronica (ou a area de assinaturas
 * do app/central oficial do SGP), abrir DevTools -> Network -> Fetch/XHR,
 * filtrar por "assinatura"/"sign"/"contrato"/"documento", disparar a
 * consulta, e capturar URL + metodo + headers de auth + body + resposta
 * JSON (sanitizando token/senha/CPF/cookie antes de colar aqui).
 */
export class SgpBackedSignatureProvider implements SignatureProvider {
  constructor(
    private readonly fallback: SignatureProvider,
    private readonly client: SgpUraClient
  ) {}

  async listSignatures(contract: ContractSummary): Promise<SignatureList> {
    if (!isLikelySgpContractId(contract.id)) {
      return this.fallback.listSignatures(contract);
    }

    try {
      if (!hasSignatureEndpoint(this.client)) {
        throw new AppError(501, "SGP_SIGNATURE_ENDPOINT_NOT_CONFIRMED", "Integracao de assinaturas do SGP ainda nao foi confirmada.");
      }

      const raw = await this.client.listSignaturesByContract(contract.id);
      return {
        source: "sgp",
        signatures: raw.map((item) => mapRawSignature(item, contract.id))
      };
    } catch {
      return { signatures: [], source: "unavailable" };
    }
  }
}

/**
 * SgpUraClient nao tem (ainda) listSignaturesByContract -- este guard existe
 * so pra este arquivo compilar/typecheck sem forcar a adicao do metodo real
 * antes de ele existir. Remover quando o metodo real for implementado.
 */
function hasSignatureEndpoint(
  client: SgpUraClient
): client is SgpUraClient & { listSignaturesByContract(contractId: string): Promise<SgpSignatureRaw[]> } {
  return typeof (client as unknown as Record<string, unknown>).listSignaturesByContract === "function";
}

interface SgpSignatureRaw {
  [key: string]: unknown;
}

/**
 * Nomes de campo em ordem de confianca: "url_assinatura"/"chave_assinatura"/
 * "data_assinatura"/"url_documento_assinado" sao vocabulario REAL do SGP
 * (variaveis de notificacao SMS/e-mail, confirmadas via wiki.sgp.net.br) --
 * mas ainda NAO confirmados como nome de campo do JSON de uma API REST
 * (essa API nunca foi encontrada). Os demais (sign_url, document_url, etc)
 * sao chute generico de fallback. Reavaliar esta lista inteira no dia em
 * que a resposta real for capturada via DevTools -- ver comentario acima de
 * SgpBackedSignatureProvider.
 */
function mapRawSignature(raw: SgpSignatureRaw, contractId: string): Signature {
  const status = mapSgpSignatureStatus(pickString(raw, ["status", "situacao"]));
  return {
    id: pickString(raw, ["id", "id_assinatura"]),
    contractId,
    title: pickString(raw, ["tipo_documento", "titulo", "documento", "descricao"]) || "Documento",
    status,
    statusLabel: getSignatureStatusLabel(status),
    createdAt: normalizeDateValue(raw.criado_em ?? raw.data_criacao) || undefined,
    signedAt: normalizeDateValue(raw.data_assinatura ?? raw.assinado_em) || undefined,
    signUrl: parseSafeHttpUrl(raw.url_assinatura ?? raw.sign_url),
    documentUrl: parseSafeHttpUrl(raw.url_documento_assinado ?? raw.url_documento ?? raw.document_url),
    signKey: pickString(raw, ["chave_assinatura", "chave"]) || undefined
  };
}

export class SgpBackedTicketProvider implements TicketProvider {
  constructor(
    private readonly fallback: TicketProvider,
    private readonly client: SgpUraClient,
    private readonly chamadoConfig: AppConfig["sgp"]["chamado"]
  ) {}

  async createTicket(input: {
    contract: ContractSummary;
    categoryTitle: string;
    description: string;
    classification: string;
    contactPhone: string;
    customerName?: string | undefined;
  }) {
    if (!isLikelySgpContractId(input.contract.id)) {
      return this.fallback.createTicket(input);
    }

    const mapping = this.chamadoConfig.mapping[input.classification];
    if (!mapping) {
      throw new AppError(
        500,
        "SGP_CHAMADO_MAPPING_MISSING",
        `Nenhum mapeamento de ocorrenciatipo/motivoos configurado para a classificacao "${input.classification}".`,
        { classification: input.classification }
      );
    }

    const result = await this.client.createCentralChamado({
      contrato: input.contract.id,
      conteudo: input.description,
      contato: input.customerName,
      contatoNumero: input.contactPhone,
      ocorrenciaTipo: mapping.ocorrenciaTipo,
      motivoOs: mapping.motivoOs,
      semOs: this.chamadoConfig.semOs
    });

    return { sgpTicketId: result.sgpTicketId, protocol: result.protocol, rawStatus: result.rawStatus };
  }

  async getTicketStatus(sgpTicketId: string) {
    return this.fallback.getTicketStatus(sgpTicketId);
  }

  async getTicketHistory(sgpTicketId: string) {
    return this.fallback.getTicketHistory(sgpTicketId);
  }

  async listTicketsByContract(contractId: string) {
    return this.fallback.listTicketsByContract(contractId);
  }

  async listOccurrencesByContract(contractId: string) {
    if (!isLikelySgpContractId(contractId)) {
      return [];
    }

    let rawOccurrences: SgpOccurrenceRaw[];
    try {
      rawOccurrences = await this.client.listOccurrencesByContract(contractId);
    } catch {
      return [];
    }

    return rawOccurrences
      .map((raw) => {
        const mapped = mapSgpOccurrence(raw, contractId);
        if (!mapped) {
          return null;
        }
        return { ...mapped, raw } as TicketSummaryWithRaw;
      })
      .filter((ticket): ticket is TicketSummaryWithRaw => ticket !== null);
  }
}

export class SgpBackedContractProvider implements ContractProvider {
  constructor(
    private readonly fallback: ContractProvider,
    private readonly client: SgpUraClient
  ) {}

  async getContracts(customerId: string) {
    const contracts = await this.fallback.getContracts(customerId);
    return Promise.all(contracts.map((contract) => this.enrichContract(contract)));
  }

  async getContract(contractId: string) {
    const contract = await this.fallback.getContract(contractId);
    if (!contract) {
      return null;
    }

    return this.enrichContract(contract);
  }

  private async enrichContract(contract: ContractSummary) {
    if (!isLikelySgpContractId(contract.id)) {
      return contract;
    }

    let contracts: SgpContractRaw[];
    try {
      contracts = await this.client.consultCustomerByContract(contract.id);
    } catch {
      return contract;
    }

    const raw = findContract(contracts, contract.id);
    if (!raw) {
      return contract;
    }

    return {
      ...contract,
      addressLine: buildAddressLine(raw) || contract.addressLine,
      city: pickString(raw, ["endereco_cidade", "enderecoCidade", "cidade"]) || contract.city,
      state: pickString(raw, ["endereco_uf", "enderecoUf", "uf"]) || contract.state,
      planName: pickString(raw, ["plano", "plano_nome", "planoNome", "servico", "servico_nome"]) || contract.planName,
      status: mapContractStatus(pickString(raw, ["status", "status_contrato", "situacao"])) ?? contract.status
    };
  }
}

export class SgpBackedNetworkProvider implements NetworkProvider {
  constructor(
    private readonly fallback: NetworkProvider,
    private readonly client: SgpUraClient
  ) {}

  /**
   * CAUSA RAIZ investigada em 2026-10-05 (caso real: cliente 18139/SALETE
   * MARIA SALDANHA, contrato 19611, servico 18082 -- SGP mostrava "1
   * Offline" no proprio painel, mas a Central exibia ONU/PON/PPPoE Online):
   * o SGP, pras credenciais /api/ura/* que esta integracao usa, NAO expoe
   * nenhum campo explicito de online/offline do servico nem sessao
   * PPPoE/Radius (testado ao vivo contra /api/ura/consultacliente/ -- so
   * devolve status ADMINISTRATIVO do contrato). O UNICO sinal tecnico real
   * disponivel e texto de diagnostico escrito manualmente em chamados
   * (ex.: "Status do equipamento: Offline"). Quando NENHUM chamado recente
   * tinha esse texto, a versao anterior deste metodo assumia
   * NORMAL/ONLINE -- exatamente a regra proibida pelo usuario
   * ("contrato ativo = online"), so que disfarçada de "ausencia de chamado
   * = tudo bem". Agora: sem sinal confiavel, devolve UNKNOWN em vez de
   * adivinhar (ver ConnectionStatusSource em types.ts).
   *
   * Prioridade das fontes, da mais pra menos confiavel:
   *   1. SGP_TICKET_DIAGNOSIS -- texto reconhecivel num chamado aberto, ou
   *      encerrado ha pouco tempo (isDiagnosisStillRelevant).
   *   2. CONTRACT_STATUS -- contrato suspenso/cancelado: nao e leitura
   *      tecnica, mas suspensao/cancelamento no SGP tipicamente corta o
   *      acesso no AAA/Radius na pratica.
   *   3. NO_EVIDENCE -- nenhuma das duas acima: UNKNOWN, nunca ONLINE nem
   *      OFFLINE inventado.
   *
   * onu/pon/pppoe continuam sincronizados entre si (nao independentes):
   * nenhuma fonte disponivel hoje informa cada um separadamente -- seria
   * fabricar precisao que a integracao atual nao tem. Telemetria realmente
   * independente por equipamento exigiria habilitar a integracao OLT Cloud
   * (ja existe em src/integrations/oltcloud/, mas so usada hoje pro painel
   * interno de incidentes regionais -- OLTCLOUD_BASE_URL vazio em producao)
   * e usa-la aqui, nunca o SGP.
   */
  async getConnectionStatus(contractId: string): Promise<ConnectionStatus | null> {
    if (!isLikelySgpContractId(contractId)) {
      return this.fallback.getConnectionStatus(contractId);
    }

    let occurrences: SgpOccurrenceRaw[];
    try {
      occurrences = await this.client.listOccurrencesByContract(contractId);
    } catch {
      return this.fallback.getConnectionStatus(contractId);
    }

    const primary = occurrences[0];
    const now = new Date().toISOString();

    /**
     * A ocorrencia mais recente nem sempre tem texto tecnico reconhecivel
     * (pode ser uma nota financeira, cadastral, ou um chamado ja finalizado
     * sem diagnostico) -- por isso procura entre as ocorrencias recentes ate
     * achar uma com status de conexao detectavel, em vez de desistir na
     * primeira sem match.
     *
     * IMPORTANTE: so confia no diagnostico textual ("Cliente offline"/etc.)
     * se o chamado que o contém ainda estiver ABERTO, ou se foi ENCERRADO
     * ha pouco tempo -- ver isDiagnosisStillRelevant.
     */
    const diagnosticOccurrence = occurrences.find(
      (occurrence) => Boolean(extractConnectionStatus(occurrence)) && isDiagnosisStillRelevant(occurrence)
    );
    const connectionStatus = diagnosticOccurrence ? extractConnectionStatus(diagnosticOccurrence) : undefined;

    if (connectionStatus && diagnosticOccurrence) {
      const offline = connectionStatus === "OFFLINE";
      const regionIssue = offline && detectRegionIssue(diagnosticOccurrence);

      return {
        contractId,
        health: offline ? "CRITICAL" : "NORMAL",
        contractStatus: "ACTIVE",
        onu: offline ? "OFFLINE" : "ONLINE",
        pon: offline ? "OFFLINE" : "ONLINE",
        pppoe: offline ? "OFFLINE" : "ONLINE",
        opticalSignal: offline ? "LOS" : "NORMAL",
        knownIncident: regionIssue,
        statusSource: "SGP_TICKET_DIAGNOSIS",
        updatedAt: now,
        ...(regionIssue ? { regionIssue } : {})
      };
    }

    const contractStatusRaw = primary ? String(pickString(primary, ["contrato_status"]) || "").toLowerCase() : "";

    if (contractStatusRaw.includes("cancel")) {
      return {
        contractId,
        health: "CRITICAL",
        contractStatus: "CANCELED",
        onu: "OFFLINE",
        pon: "OFFLINE",
        pppoe: "OFFLINE",
        opticalSignal: "LOS",
        knownIncident: false,
        statusSource: "CONTRACT_STATUS",
        updatedAt: now
      };
    }

    if (contractStatusRaw.includes("susp") || contractStatusRaw.includes("bloq")) {
      return {
        contractId,
        health: "CRITICAL",
        contractStatus: "SUSPENDED",
        onu: "OFFLINE",
        pon: "OFFLINE",
        pppoe: "OFFLINE",
        opticalSignal: "LOS",
        knownIncident: false,
        statusSource: "CONTRACT_STATUS",
        updatedAt: now
      };
    }

    return {
      contractId,
      health: "UNKNOWN",
      contractStatus: "ACTIVE",
      onu: "UNKNOWN",
      pon: "UNKNOWN",
      pppoe: "UNKNOWN",
      opticalSignal: "UNKNOWN",
      knownIncident: false,
      statusSource: "NO_EVIDENCE",
      updatedAt: now
    };
  }
}

/** Chamado encerrado ha mais que isso nunca mais conta como diagnostico atual -- so como historico. */
const STALE_CLOSED_DIAGNOSIS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Um chamado ainda ABERTO reflete um problema em andamento agora -- confia
 * sempre. Um chamado ENCERRADO so conta como diagnostico atual se foi
 * encerrado ha pouco tempo (a resolucao ainda e recente o bastante pra valer
 * como "estado de agora"); passado isso, o diagnostico e so historico e
 * nunca deve ser usado pra dizer que o contrato esta offline/instavel hoje.
 */
function isDiagnosisStillRelevant(occurrence: SgpOccurrenceRaw): boolean {
  const statusText = pickString(occurrence, ["status"]);
  const isClosed = statusText ? mapSgpStatus(statusText) === "RESOLVED" || mapSgpStatus(statusText) === "CANCELED" : false;

  if (!isClosed) {
    return true;
  }

  const dateText = pickString(occurrence, ["data_finalizacao", "data_cadastro"]);
  const timestamp = dateText ? new Date(dateText).getTime() : NaN;
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= STALE_CLOSED_DIAGNOSIS_WINDOW_MS;
}

function detectRegionIssue(raw: SgpOccurrenceRaw): boolean {
  const content = String(pickString(raw, ["conteudo", "descricao", "observacao"]) || "").toLowerCase();
  const osContent = Array.isArray((raw as Record<string, unknown>).ordens_servicos)
    ? ((raw as Record<string, unknown>).ordens_servicos as Record<string, unknown>[])[0]
    : undefined;

  const osContentText = osContent ? String(pickString(osContent, ["conteudo", "descricao", "observacao"]) || "").toLowerCase() : "";
  const combined = `${content} ${osContentText}`;

  const osStatus = String(pickString(raw, ["status"]) || "").toLowerCase();
  const primaryOsStatus = osContent ? String(pickString(osContent, ["status"]) || "").toLowerCase() : "";

  if (osStatus.includes("backbone") || primaryOsStatus.includes("backbone")) {
    return true;
  }

  return combined.includes("backbone");
}

function isLikelySgpContractId(value: string) {
  return /^\d+$/.test(value);
}

function findContract(contracts: SgpContractRaw[], contractId: string) {
  return contracts.find((item) => String(pickString(item, ["id_contrato", "contratoId", "idContrato", "contrato_id"])) === contractId) ?? contracts[0];
}

function buildAddressLine(contract: SgpContractRaw) {
  return [
    pickString(contract, ["endereco_logradouro", "enderecoLogradouro", "logradouro"]),
    pickString(contract, ["endereco_numero", "enderecoNumero", "numero"]),
    pickString(contract, ["endereco_bairro", "enderecoBairro", "bairro"])
  ]
    .filter(Boolean)
    .join(", ");
}

function pickString(record: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

const billingAmountFields = [
  "contratoValorAberto",
  "contrato_valor_aberto",
  "valorAberto",
  "valor_aberto",
  "valorEmAberto",
  "valor_em_aberto",
  "totalAberto",
  "total_aberto",
  "titulosValorAberto",
  "titulos_valor_aberto",
  "saldo",
  "saldoDevedor",
  "saldo_devedor"
];

const billingDueDateFields = [
  "vencimento",
  "data_vencimento",
  "dataVencimento",
  "proximo_vencimento",
  "proximoVencimento",
  "proxima_fatura_vencimento",
  "proximaFaturaVencimento",
  "titulo_vencimento",
  "tituloVencimento",
  "vencimento_atual",
  "vencimentoAtual"
];

const billingDueDayFields = ["dia_vencimento", "diaVencimento", "vencimento_dia", "vencimentoDia", "vencimento"];

function belongsToContract(invoice: SgpInvoiceRaw, contractId: string) {
  return String(invoice.clienteContrato ?? "").trim() === contractId;
}

function mapSgpInvoice(raw: SgpInvoiceRaw): BillingInvoice | null {
  const rawStatus = normalizeComparisonText(pickString(raw, ["status"]));
  if (!rawStatus || rawStatus.includes("cancel")) {
    return null;
  }

  const dueDate = normalizeDateValue(raw.dataVencimento);
  const paidAt = normalizeDateValue(raw.dataPagamento);
  let status: BillingInvoice["status"];

  if (rawStatus === "pago" || rawStatus === "baixado" || rawStatus === "liquidado") {
    status = "PAID";
  } else if (rawStatus === "aberto") {
    status = dueDate && isPastDate(dueDate) ? "OVERDUE" : "OPEN";
  } else {
    return null;
  }

  const id = pickString(raw, ["id"]);
  const number = pickString(raw, ["numeroDocumento"]);
  if (!id || !number) {
    return null;
  }

  const amount = parseFinancialValue(raw.valor);
  const printUrl = parseSafeHttpUrl(raw.link);
  const pixUrl = parseSafeHttpUrl(raw.link_cobranca);
  const barcode = pickString(raw, ["linhaDigitavel", "codigoBarras"]);
  const pixCopyPaste = pickString(raw, ["codigoPix"]);
  const daysLate = status === "OVERDUE" && dueDate ? calculateDaysLate(dueDate) : 0;

  return {
    id,
    number,
    status,
    ...(amount !== undefined ? { amount } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(status === "PAID" && paidAt ? { paidAt } : {}),
    ...(daysLate > 0 ? { daysLate } : {}),
    ...(status !== "PAID" && printUrl ? { printUrl } : {}),
    ...(status !== "PAID" && barcode ? { barcode } : {}),
    ...(status !== "PAID" && pixCopyPaste ? { pixCopyPaste } : {}),
    ...(status !== "PAID" && pixUrl ? { pixUrl } : {})
  };
}

function normalizeComparisonText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function parseSafeHttpUrl(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }

  try {
    const url = new URL(text);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function buildBillingSummaryFromSgp(contractId: string, raw: SgpContractRaw): BillingSummary {
  const amountOpen = pickNumberDeep(raw, billingAmountFields);
  const nextDueDate = pickDateDeep(raw, billingDueDateFields);
  const dueDay = pickDueDayDeep(raw, billingDueDayFields);
  const status = deriveBillingStatus(amountOpen, nextDueDate);

  return {
    contractId,
    status,
    updatedAt: new Date().toISOString(),
    source: "sgp",
    ...(amountOpen !== undefined ? { amountOpen } : {}),
    ...(nextDueDate ? { nextDueDate } : {}),
    ...(dueDay !== undefined ? { dueDay } : {})
  };
}

function unavailableBillingSummary(contractId: string): BillingSummary {
  return {
    contractId,
    status: "UNKNOWN",
    updatedAt: new Date().toISOString(),
    source: "unavailable"
  };
}

function deriveBillingStatus(amountOpen: number | undefined, nextDueDate: string | undefined): BillingSummary["status"] {
  if (amountOpen !== undefined) {
    if (amountOpen <= 0) {
      return "PAID";
    }

    return nextDueDate && isPastDate(nextDueDate) ? "OVERDUE" : "OPEN";
  }

  if (nextDueDate) {
    return isPastDate(nextDueDate) ? "OVERDUE" : "OPEN";
  }

  return "UNKNOWN";
}

function getMaxDaysLate(invoices: BillingInvoice[]) {
  return invoices.reduce((maxDaysLate, invoice) => {
    if (invoice.status !== "OVERDUE" || typeof invoice.daysLate !== "number") {
      return maxDaysLate;
    }

    return Math.max(maxDaysLate, invoice.daysLate);
  }, 0);
}

function pickNumberDeep(record: Record<string, unknown>, fields: string[]) {
  for (const value of collectDeepValues(record, fields)) {
    const parsed = parseFinancialValue(value);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  return undefined;
}

function pickDateDeep(record: Record<string, unknown>, fields: string[]) {
  const dates = collectDeepValues(record, fields)
    .map(normalizeDateValue)
    .filter((value): value is string => Boolean(value))
    .sort();

  if (dates.length === 0) {
    return undefined;
  }

  const today = formatDate(new Date());
  const upcoming = dates.find((value) => value >= today);
  return upcoming ?? dates[dates.length - 1];
}

function pickDueDayDeep(record: Record<string, unknown>, fields: string[]) {
  for (const value of collectDeepValues(record, fields)) {
    const parsed = parseDueDay(value);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  return undefined;
}

function collectDeepValues(record: Record<string, unknown>, fields: string[]) {
  const targets = new Set(fields.map(normalizeFieldName));
  const values: unknown[] = [];
  const queue: Array<{ value: unknown; depth: number }> = [{ value: record, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth > 4 || !current.value || typeof current.value !== "object") {
      continue;
    }

    if (Array.isArray(current.value)) {
      for (const item of current.value) {
        queue.push({ value: item, depth: current.depth + 1 });
      }
      continue;
    }

    for (const [key, value] of Object.entries(current.value as Record<string, unknown>)) {
      if (targets.has(normalizeFieldName(key))) {
        values.push(value);
      }

      if (value && typeof value === "object") {
        queue.push({ value, depth: current.depth + 1 });
      }
    }
  }

  return values;
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseFinancialValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }

  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") {
    return undefined;
  }

  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDateValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || /^\d{1,2}$/.test(text)) {
    return undefined;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const [, day, month, year] = br;
    return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
  }

  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function parseDueDay(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31) {
    return value;
  }

  const text = String(value ?? "").trim();
  if (!/^\d{1,2}$/.test(text)) {
    return undefined;
  }

  const parsed = Number(text);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : undefined;
}

function isPastDate(value: string) {
  return calculateDaysLate(value) > 0;
}

function calculateDaysLate(value: string, now = new Date()) {
  const dueDate = parseCalendarDate(value);
  if (!dueDate) {
    return 0;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedDays = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);
  return Math.max(0, elapsedDays);
}

function parseCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mapContractStatus(value: string) {
  const normalized = value.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("ativo") || normalized.includes("active")) {
    return "ACTIVE" as const;
  }
  if (normalized.includes("susp") || normalized.includes("bloq")) {
    return "SUSPENDED" as const;
  }
  if (normalized.includes("cancel")) {
    return "CANCELED" as const;
  }
  return "UNKNOWN" as const;
}
