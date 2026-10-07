import type { Appointment, DiagnosisCategoryId, PublicTicketVisit, TicketTimelineEvent } from "../types.js";
import { AppError } from "../errors.js";
import { CONTACT_PLACEHOLDER, evaluateDiagnosis, getFastDiagnosisQuestion } from "../diagnosis/engine.js";
import { supportCategories } from "../diagnosis/categories.js";
import type { AppointmentProvider, BillingProvider, NetworkProvider, TicketProvider } from "../integrations/sgp/providers.js";
import { mapSgpStatus, normalizeChamadoStatus } from "../integrations/sgp/statusMapper.js";
import { mapSgpOsToCustomerVisit } from "../integrations/sgp/sgpMapper.js";
import type { InMemoryStore, TicketRecord } from "../repositories/inMemoryStore.js";
import { randomId } from "../security/hash.js";
import { OwnershipService } from "../security/ownership.js";
import type { TicketSummaryWithRaw } from "../integrations/sgp/providers.js";
import type { SgpUraClient } from "../integrations/sgp/sgpClient.js";
import { formatBrazilianPhone, normalizeBrazilianPhone } from "../auth/cpf.js";

/** Chamado fechado some do historico (listTickets) depois desses dias, contando do fechamento -- nao afeta chamado ainda ativo. */
const TICKET_HISTORY_RETENTION_DAYS = 30;

/**
 * O SGP so da uma hora real de "atualizado" quando ha agendamento
 * (data_agendamento) ou o chamado foi fechado (data_finalizacao) -- fora
 * isso, mapSgpOsToCustomerVisit fabrica "updatedAt" reusando a data de
 * abertura com hora "00:00", que nao e um sinal real de atualizacao.
 */
function hasRealUpdateSignal(ticket: PublicTicketVisit) {
  return Boolean(ticket.appointment?.windowStart) || ticket.statusInterno === "closed";
}

export class SupportService {
  private readonly ownership: OwnershipService;
  /**
   * Guarda em memoria contra duplo-clique/retry concorrente na criacao de
   * chamado: cobre a janela de corrida DURANTE o round-trip ao SGP, que a
   * checagem por consulta ao SGP (findOpenTicketByContract, que roda ANTES
   * do round-trip) nao cobre. So funciona porque este backend roda como
   * processo unico -- se vier a escalar horizontalmente, precisa virar um
   * lock distribuido.
   */
  private readonly inFlightTicketCreations = new Set<string>();

  constructor(
    private readonly store: InMemoryStore,
    private readonly networkProvider: NetworkProvider,
    private readonly ticketProvider: TicketProvider,
    private readonly appointmentProvider: AppointmentProvider,
    private readonly billingProvider: BillingProvider,
    sgpClient?: SgpUraClient
  ) {
    this.ownership = new OwnershipService(store, sgpClient);
  }

  categories() {
    return supportCategories;
  }

  async diagnose(input: {
    customerId: string;
    contractId: string;
    categoryId: DiagnosisCategoryId;
    answers: Record<string, string>;
  }) {
    const contract = await this.ownership.assertContract(input.customerId, input.contractId);
    /**
     * "slow_internet" fica de fora do atalho: precisa checar fatura em
     * atraso (evaluateDiagnosis) antes de decidir se ainda falta pergunta,
     * senao o atalho devolve QUESTION sem nunca considerar o atraso.
     */
    const fastQuestion =
      contract.status === "ACTIVE" && input.categoryId !== "slow_internet"
        ? getFastDiagnosisQuestion({ categoryId: input.categoryId, answers: input.answers })
        : undefined;

    if (fastQuestion) {
      return fastQuestion;
    }

    const connection = await this.networkProvider.getConnectionStatus(input.contractId);

    if (!connection) {
      throw new AppError(404, "CONNECTION_NOT_FOUND", "Nao encontramos dados de conexao para este contrato.");
    }

    const billing =
      input.categoryId === "slow_internet" ? await this.billingProvider.getBillingSummary(contract) : undefined;

    const preliminaryResult = evaluateDiagnosis({
      categoryId: input.categoryId,
      contract,
      connection,
      answers: input.answers,
      ...(billing ? { billing } : {})
    });

    if (preliminaryResult.state === "QUESTION") {
      return preliminaryResult;
    }

    const duplicate = await this.findOpenTicketByContract(input.contractId);
    const result = duplicate
      ? evaluateDiagnosis({
          categoryId: input.categoryId,
          contract,
          connection,
          answers: input.answers,
          duplicateTicketId: duplicate.id,
          ...(billing ? { billing } : {})
        })
      : preliminaryResult;

    const diagnosis =
      result.state === "SUMMARY" || result.state === "BLOCKED"
        ? this.store.createDiagnosis({
            customerId: input.customerId,
            contractId: input.contractId,
            categoryId: input.categoryId,
            answers: input.answers,
            result
          })
        : undefined;

    return { diagnosisId: diagnosis?.id, ...result };
  }

  async createTicket(input: { customerId: string; contractId: string; diagnosisId: string; contactPhone: string }) {
    const contract = await this.ownership.assertContract(input.customerId, input.contractId);
    const diagnosis = this.ownership.assertDiagnosis(input.customerId, input.diagnosisId);

    if (diagnosis.contractId !== input.contractId) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso nao encontrado.");
    }

    if (!diagnosis.result.canOpenTicket || !diagnosis.result.structuredDescription) {
      throw new AppError(422, "DIAGNOSIS_NOT_ESCALATABLE", "Finalize a triagem antes de abrir chamado.");
    }

    const contactPhone = normalizeBrazilianPhone(input.contactPhone);
    if (!contactPhone) {
      throw new AppError(422, "INVALID_CONTACT_PHONE", "Informe um telefone brasileiro valido para contato.");
    }

    const guardKey = `${input.customerId}:${input.contractId}`;
    if (this.inFlightTicketCreations.has(guardKey)) {
      throw new AppError(409, "DUPLICATE_TICKET_IN_PROGRESS", "Ja existe uma solicitacao de chamado em andamento para este contrato.");
    }
    this.inFlightTicketCreations.add(guardKey);

    try {
      const existing = await this.findOpenTicketByContract(input.contractId);
      if (existing) {
        throw new AppError(409, "DUPLICATE_TICKET", "Voce ja possui um chamado em andamento.", {
          existingTicketId: existing.id,
          protocol: existing.protocol
        });
      }

      const category = supportCategories.find((item) => item.id === diagnosis.categoryId);
      const isAutomaticOfflineTicket =
        diagnosis.categoryId === "no_internet" &&
        diagnosis.result.classification === "FALHA_REDE_ACESSO" &&
        Boolean(diagnosis.answers.offline_initial_option);
      const ticketTitle = isAutomaticOfflineTicket ? "CLIENTE OFFLINE" : category?.title ?? "Suporte";
      const ticketDescription = insertContactPhone(diagnosis.result.structuredDescription, contactPhone);
      const customer = this.store.getCustomer(input.customerId);

      let sgpTicket: { sgpTicketId: string; protocol: string; rawStatus: string };
      try {
        sgpTicket = await this.ticketProvider.createTicket({
          contract,
          categoryTitle: ticketTitle,
          description: ticketDescription,
          classification: diagnosis.result.classification ?? "TRIAGEM_GERAL",
          contactPhone,
          customerName: customer?.name
        });
      } catch (error) {
        this.store.recordAudit({
          type: "TICKET_CREATED",
          customerId: input.customerId,
          metadata: {
            contractId: contract.id,
            diagnosisId: diagnosis.id,
            failed: true,
            errorCode: error instanceof AppError ? error.code : "UNKNOWN"
          }
        });

        if (error instanceof AppError) {
          throw error;
        }

        throw new AppError(
          502,
          "SGP_TICKET_CREATE_FAILED",
          "Nao foi possivel concluir a abertura do chamado neste momento. Suas informacoes foram preservadas."
        );
      }

      const now = new Date().toISOString();
      const timeline: TicketTimelineEvent[] = [
        { id: randomId("event"), status: "RECEIVED", title: "Chamado recebido", occurredAt: now }
      ];

      const shouldSchedule =
        diagnosis.categoryId === "no_internet" && diagnosis.result.classification === "FALHA_REDE_ACESSO";

      const appointment = shouldSchedule
        ? createAppointment(contract.id, sgpTicket.protocol, contract.addressLine, contract.city, contract.state)
        : undefined;

      if (appointment) {
        timeline.push({
          id: randomId("event"),
          status: "SCHEDULED",
          title: "Visita agendada",
          occurredAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          description: `${appointment.date} das ${appointment.windowStart} as ${appointment.windowEnd}`
        });
      }

      const ticket = this.store.createTicket({
        customerId: input.customerId,
        contractId: input.contractId,
        diagnosisId: diagnosis.id,
        sgpTicketId: sgpTicket.sgpTicketId,
        protocol: sgpTicket.protocol,
        status: appointment ? "SCHEDULED" : mapSgpStatus(sgpTicket.rawStatus),
        title: ticketTitle,
        description: ticketDescription,
        timeline,
        ...(appointment ? { appointment } : {})
      });

      this.store.recordAudit({
        type: "TICKET_CREATED",
        customerId: input.customerId,
        metadata: {
          ticketId: ticket.id,
          contractId: contract.id,
          ...(isAutomaticOfflineTicket ? { automaticOffline: true } : {})
        }
      });

      return ticket;
    } finally {
      this.inFlightTicketCreations.delete(guardKey);
    }
  }

  async listTickets(customerId: string): Promise<PublicTicketVisit[]> {
    const localTickets = this.store.listTickets(customerId);
    const customer = this.store.getCustomer(customerId);
    const contracts = customer ? this.store.listContracts(customer.id) : [];

    const occurrenceResults = await Promise.all(
      contracts
        .filter((contract) => /^\d+$/.test(contract.id))
        .map((contract) => this.ticketProvider.listOccurrencesByContract(contract.id))
    );
    const occurrenceTickets = occurrenceResults.flat();

    const occurrenceMapped = occurrenceTickets
      .map((sgpTicket) => mapSgpOsToCustomerVisit((sgpTicket as TicketSummaryWithRaw).raw, sgpTicket.contractId))
      .filter((ticket): ticket is PublicTicketVisit => ticket !== null);

    const localMapped = localTickets.map((ticket) => {
      const normalized = normalizeChamadoStatus(ticket.status);
      return {
        id: ticket.id,
        protocol: ticket.protocol,
        contractId: ticket.contractId,
        status: ticket.status,
        statusInterno: normalized.status,
        title: ticket.title,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        appointment: ticket.appointment
      };
    });

    const byProtocol = new Map<string, PublicTicketVisit>();
    for (const ticket of localMapped) {
      byProtocol.set(ticket.protocol, ticket);
    }

    /**
     * O SGP prevalece sobre o dado local quando o mesmo protocolo existe nos
     * dois: o registro local nunca e atualizado apos a criacao (nao existe
     * webhook/polling de status do SGP), entao so o SGP sabe se o chamado
     * foi fechado -- sem isso, um chamado criado pelo app nunca aparecia
     * como fechado no historico, mesmo depois de fechado de verdade.
     */
    for (const ticket of occurrenceMapped) {
      const existingLocal = byProtocol.get(ticket.protocol);
      // "createdAt" do SGP (/api/ura/ocorrencia/list/) so tem a data, sem hora (confirmado ao
      // vivo em 2026-09-28) -- viraria sempre "00:00" pro cliente. O registro local sabe a hora
      // real de quando o chamado foi criado pelo app, entao prevalece quando existir.
      const resolvedCreatedAt = existingLocal?.createdAt ?? ticket.createdAt;
      byProtocol.set(ticket.protocol, {
        ...existingLocal,
        ...ticket,
        appointment: ticket.appointment ?? existingLocal?.appointment,
        createdAt: resolvedCreatedAt,
        // "updatedAt" do mapper so tem hora real quando ha agendamento (data_agendamento) ou
        // fechamento (data_finalizacao) -- fora isso ele reusa a mesma data de abertura com hora
        // fabricada ("00:00"), que ficava diferente (e mais errada) do "Aberto em" ja corrigido
        // acima. Sem um sinal real de atualizacao, mostra a mesma abertura com a hora real.
        updatedAt: hasRealUpdateSignal(ticket) ? ticket.updatedAt : resolvedCreatedAt
      });
    }

    /**
     * Historico do cliente: inclui chamados fechados (com motivo de
     * encerramento quando o SGP fornecer), nao so os em andamento -- mas um
     * chamado fechado ha mais de 30 dias some da lista (contando a partir do
     * fechamento real, "updatedAt", nao da abertura). Chamado ainda ativo
     * nunca some por idade, independente de quando foi aberto.
     */
    const thirtyDaysAgo = Date.now() - TICKET_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return Array.from(byProtocol.values())
      .filter((ticket) => ticket.statusInterno !== "closed" || new Date(ticket.updatedAt).getTime() >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getTicket(customerId: string, ticketId: string) {
    const localTicket = this.store.tickets.get(ticketId);
    if (localTicket && localTicket.customerId === customerId) {
      this.store.recordAudit({ type: "TICKET_VIEWED", customerId, metadata: { ticketId } });
      return sanitizeTicketRecord(localTicket);
    }

    const customer = this.store.getCustomer(customerId);
    const contracts = customer ? this.store.listContracts(customer.id) : [];
    const sgpTickets = await Promise.all(
      contracts
        .filter((contract) => /^\d+$/.test(contract.id))
        .map((contract) => this.ticketProvider.listOccurrencesByContract(contract.id))
    );

    const sgpTicket = sgpTickets.flat().find((ticket) => ticket.id === ticketId || ticket.protocol === ticketId);
    if (sgpTicket) {
      const mapped = mapSgpOsToCustomerVisit((sgpTicket as TicketSummaryWithRaw).raw, sgpTicket.contractId);
      if (mapped) {
        this.store.recordAudit({ type: "TICKET_VIEWED", customerId, metadata: { ticketId } });
        return mapped;
      }
    }

    throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso nao encontrado.");
  }

  async getTimeline(customerId: string, ticketId: string) {
    const localTicket = this.store.tickets.get(ticketId);
    if (localTicket && localTicket.customerId === customerId) {
      return localTicket.timeline;
    }

    throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso nao encontrado.");
  }

  async getAppointment(customerId: string, ticketId: string): Promise<Appointment | null> {
    const localTicket = this.store.tickets.get(ticketId);
    if (localTicket && localTicket.customerId === customerId) {
      this.store.recordAudit({ type: "APPOINTMENT_VIEWED", customerId, metadata: { ticketId } });
      return localTicket.appointment ?? (await this.appointmentProvider.getAppointment(ticketId));
    }

    throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso nao encontrado.");
  }

  async getCurrentTicket(customerId: string, contractId: string) {
    const localTickets = this.store
      .listTickets(customerId)
      .filter((ticket) => ticket.contractId === contractId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    /**
     * O SGP e consultado ANTES do dado local e prevalece quando os dois
     * existem: o registro local nunca e atualizado apos a criacao do
     * chamado (nao ha webhook/polling de status), entao confiar nele
     * primeiro fazia o app mostrar "em andamento" para sempre, mesmo apos o
     * chamado ser fechado de verdade no SGP.
     */
    const sgpOccurrences = await this.ticketProvider.listOccurrencesByContract(contractId);
    const mappedOccurrences = sgpOccurrences
      .map((ticket) => mapSgpOsToCustomerVisit((ticket as TicketSummaryWithRaw).raw, ticket.contractId))
      .filter((ticket): ticket is PublicTicketVisit => ticket !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const localByProtocol = new Map(localTickets.map((ticket) => [ticket.protocol, ticket]));
    /** /api/ura/ocorrencia/list/ so devolve a DATA de criacao, sem hora (confirmado ao vivo em 2026-09-28) -- viraria sempre "00:00". O registro local sabe a hora real quando existir. */
    const openedAtFor = (ticket: PublicTicketVisit) => localByProtocol.get(ticket.protocol)?.createdAt ?? ticket.createdAt;
    /** Sem sinal real de atualizacao (ver hasRealUpdateSignal), mostra a mesma abertura com a hora real em vez do "00:00" fabricado pelo mapper. */
    const updatedAtFor = (ticket: PublicTicketVisit) => (hasRealUpdateSignal(ticket) ? ticket.updatedAt : openedAtFor(ticket));
    const sgpTicketMatchingLocal = mappedOccurrences.find((ticket) => localByProtocol.has(ticket.protocol));
    const activeSgpTicket = mappedOccurrences.find((ticket) => ticket.statusInterno !== "closed");

    if (activeSgpTicket) {
      return {
        hasTicket: true,
        active: true,
        ticket: {
          id: activeSgpTicket.id,
          protocol: activeSgpTicket.protocol,
          contractId: activeSgpTicket.contractId,
          status: activeSgpTicket.status,
          statusInterno: activeSgpTicket.statusInterno,
          rawStatus: activeSgpTicket.status,
          title: activeSgpTicket.title,
          openedAt: openedAtFor(activeSgpTicket),
          updatedAt: updatedAtFor(activeSgpTicket),
          appointment: activeSgpTicket.appointment,
          ...(activeSgpTicket.connectionStatus ? { connectionStatus: activeSgpTicket.connectionStatus } : {})
        }
      };
    }

    /** Chamado local encontrado no SGP e fechado la -- o SGP prevalece (inclusive o motivo de fechamento). */
    if (sgpTicketMatchingLocal) {
      return {
        hasTicket: true,
        active: false,
        ticket: {
          id: sgpTicketMatchingLocal.id,
          protocol: sgpTicketMatchingLocal.protocol,
          contractId: sgpTicketMatchingLocal.contractId,
          status: sgpTicketMatchingLocal.status,
          statusInterno: sgpTicketMatchingLocal.statusInterno,
          rawStatus: sgpTicketMatchingLocal.status,
          title: sgpTicketMatchingLocal.title,
          openedAt: openedAtFor(sgpTicketMatchingLocal),
          updatedAt: updatedAtFor(sgpTicketMatchingLocal),
          appointment: sgpTicketMatchingLocal.appointment,
          ...(sgpTicketMatchingLocal.closureReason ? { closureReason: sgpTicketMatchingLocal.closureReason } : {})
        }
      };
    }

    /** Sem correspondencia no SGP (contrato mock/local, ou ainda nao propagou): usa o local ou o SGP mais recente, o que existir. */
    const lastLocal = localTickets[0];
    const lastSgp = mappedOccurrences[0];
    const last = [lastLocal, lastSgp]
      .filter((ticket): ticket is TicketRecord | PublicTicketVisit => Boolean(ticket))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!last) {
      return { hasTicket: false, active: false, ticket: null };
    }

    const normalized = normalizeChamadoStatus(last.status);
    return {
      hasTicket: true,
      active: normalized.status !== "closed",
      ticket: {
        id: last.id,
        protocol: last.protocol,
        contractId: last.contractId,
        status: last.status,
        statusInterno: normalized.status,
        rawStatus: last.status,
        title: last.title,
        openedAt: last.createdAt,
        updatedAt: last.updatedAt,
        appointment: last.appointment,
        ...("connectionStatus" in last && last.connectionStatus ? { connectionStatus: last.connectionStatus } : {}),
        ...("closureReason" in last && last.closureReason ? { closureReason: last.closureReason } : {})
      }
    };
  }

  private async findOpenTicketByContract(contractId: string) {
    const sgpTickets = await this.ticketProvider.listOccurrencesByContract(contractId);
    const mappedSgpTickets = sgpTickets
      .map((ticket) => mapSgpOsToCustomerVisit((ticket as TicketSummaryWithRaw).raw, ticket.contractId))
      .filter((ticket): ticket is PublicTicketVisit => ticket !== null);
    const activeSgpTicket = mappedSgpTickets
      .filter((ticket) => ticket.statusInterno !== "closed")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (activeSgpTicket) {
      return { id: activeSgpTicket.id, protocol: activeSgpTicket.protocol };
    }

    const localTicket = this.store.findOpenTicketByContract(contractId);
    if (localTicket) {
      const localIdentifiers = new Set([localTicket.id, localTicket.protocol, localTicket.sgpTicketId].filter(Boolean));
      const closedInSgp = mappedSgpTickets.some(
        (ticket) => ticket.statusInterno === "closed" && (localIdentifiers.has(ticket.id) || localIdentifiers.has(ticket.protocol))
      );

      if (!closedInSgp && normalizeChamadoStatus(localTicket.status).status !== "closed") {
        return { id: localTicket.id, protocol: localTicket.protocol };
      }
    }

    return undefined;
  }
}

/** Preenche o placeholder deixado por buildTicketDescription (server/src/diagnosis/engine.ts) na linha "Contato:" do bloco Cliente -- o telefone so e coletado depois da triagem, na abertura do chamado. */
function insertContactPhone(description: string, contactPhone: string) {
  return description.replace(CONTACT_PLACEHOLDER, formatBrazilianPhone(contactPhone));
}

function sanitizeTicketRecord(ticket: TicketRecord) {
  const { customerId: _customerId, diagnosisId: _diagnosisId, sgpTicketId: _sgpTicketId, timeline: _timeline, ...rest } = ticket;
  return rest;
}

function createAppointment(
  contractId: string,
  protocol: string,
  addressLine: string,
  city: string,
  state: string
): Appointment {
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return {
    id: randomId("appt"),
    ticketId: protocol,
    contractId,
    date: date.toISOString().slice(0, 10),
    windowStart: "14:00",
    windowEnd: "16:00",
    addressLine,
    city,
    state
  };
}
