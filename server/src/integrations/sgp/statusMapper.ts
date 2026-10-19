import type { TicketStatus, TicketInternalStatus, TicketStatusNormalized } from "../../types.js";

const statusMap: Record<string, TicketStatus> = {
  aberta: "RECEIVED",
  aberto: "RECEIVED",
  recebida: "RECEIVED",
  recebido: "RECEIVED",
  em_analise: "ANALYZING",
  analisando: "ANALYZING",
  aguardando_cliente: "WAITING_CUSTOMER",
  encaminhado: "FORWARDED",
  agendando: "SCHEDULING",
  agendado: "SCHEDULED",
  tecnico_a_caminho: "TECH_ON_THE_WAY",
  em_execucao: "IN_PROGRESS",
  em_atendimento: "IN_PROGRESS",
  concluido: "RESOLVED",
  encerrada: "RESOLVED",
  cancelado: "CANCELED",
  finalizada: "RESOLVED",
  finalizado: "RESOLVED",
  fechada: "RESOLVED",
  fechado: "RESOLVED",
  encerrado: "RESOLVED",
  cancelada: "CANCELED",
  resolvida: "RESOLVED",
  resolvido: "RESOLVED",
  agendada: "SCHEDULED",
  em_andamento: "IN_PROGRESS",
  andamento: "IN_PROGRESS",
  resolved: "RESOLVED",
  canceled: "CANCELED",
  scheduled: "SCHEDULED",
  in_progress: "IN_PROGRESS",
  received: "RECEIVED",
  analyzing: "ANALYZING"
};

const CLOSED_KEYWORDS = ["encerrad", "finalizad", "concluid", "fechad", "cancelad", "resolvid"];

function normalizeStatusText(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function mapSgpStatus(rawStatus: string): TicketStatus {
  const normalizedText = normalizeStatusText(rawStatus);
  if (normalizedText.includes("cancelad")) {
    return "CANCELED";
  }

  if (CLOSED_KEYWORDS.some((keyword) => normalizedText.includes(keyword))) {
    return "RESOLVED";
  }

  const normalized = normalizedText.replace(/\s+/g, "_");
  return statusMap[normalized] ?? "ANALYZING";
}

export function normalizeChamadoStatus(rawStatus: string): TicketStatusNormalized {
  const trimmed = rawStatus.trim();

  const ticketStatus = mapSgpStatus(trimmed);

  const openStatuses = new Set<TicketStatus>(["RECEIVED", "ANALYZING", "WAITING_CUSTOMER", "FORWARDED"]);
  const scheduledStatuses = new Set<TicketStatus>(["SCHEDULING", "SCHEDULED"]);
  const inProgressStatuses = new Set<TicketStatus>(["TECH_ON_THE_WAY", "IN_PROGRESS"]);
  const closedStatuses = new Set<TicketStatus>(["RESOLVED", "CANCELED"]);

  if (openStatuses.has(ticketStatus)) {
    return { status: "open", rawStatus: trimmed };
  }

  if (scheduledStatuses.has(ticketStatus)) {
    return { status: "scheduled", rawStatus: trimmed };
  }

  if (inProgressStatuses.has(ticketStatus)) {
    return { status: "in_progress", rawStatus: trimmed };
  }

  if (closedStatuses.has(ticketStatus)) {
    return { status: "closed", rawStatus: trimmed };
  }

  return { status: "open", rawStatus: trimmed };
}
