/**
 * Substitui o pacote @acessanet/shared (do repo AcessaNet app, que este
 * backend nao deve depender): so os tipos realmente usados aqui, copiados
 * verbatim de packages/shared/src/index.ts.
 */

export const ticketStatuses = [
  "RECEIVED",
  "ANALYZING",
  "WAITING_CUSTOMER",
  "FORWARDED",
  "SCHEDULING",
  "SCHEDULED",
  "TECH_ON_THE_WAY",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELED"
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export type TicketInternalStatus = "open" | "scheduled" | "in_progress" | "closed";

export interface TicketStatusNormalized {
  status: TicketInternalStatus;
  rawStatus: string;
}

export type ContractStatus = "ACTIVE" | "SUSPENDED" | "CANCELED" | "UNKNOWN";
export type ConnectionHealth = "NORMAL" | "WARNING" | "CRITICAL" | "UNKNOWN";
export type TechnicalState = "ONLINE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";

/**
 * De onde veio onu/pon/pppoe/health em ConnectionStatus -- nenhuma dessas
 * fontes e uma leitura tecnica EM TEMPO REAL (o SGP nao expoe, pras
 * credenciais /api/ura/* disponiveis hoje, nenhum campo explicito de
 * online/offline do servico nem sessao PPPoE/Radius; ver investigacao em
 * SgpBackedNetworkProvider.getConnectionStatus). Existe pra deixar
 * explicito pro frontend (e pra quem le o JSON) o quao forte e cada sinal,
 * em vez de apresentar tudo como se fosse igualmente confiavel.
 */
export type ConnectionStatusSource =
  /** Texto de diagnostico reconhecivel num chamado (aberto, ou encerrado ha pouco tempo). Unico sinal ligado a um relato tecnico real disponivel hoje. */
  | "SGP_TICKET_DIAGNOSIS"
  /** Inferido do status administrativo do contrato (suspenso/cancelado) -- nao e leitura tecnica direta, so uma consequencia operacional conhecida. */
  | "CONTRACT_STATUS"
  /** Nenhum sinal confiavel disponivel -- motivo pelo qual health/onu/pon/pppoe vem "UNKNOWN". */
  | "NO_EVIDENCE";

export interface CustomerProfile {
  id: string;
  name: string;
  maskedCpf: string;
  maskedPhone: string;
}

export interface ContractSummary {
  id: string;
  customerId: string;
  addressLine: string;
  city: string;
  state: string;
  planName: string;
  status: ContractStatus;
}

export type BillingStatus = "OPEN" | "PAID" | "OVERDUE" | "UNKNOWN";
export type BillingSource = "sgp" | "mock" | "unavailable";

export interface BillingSummary {
  contractId: string;
  status: BillingStatus;
  amountOpen?: number;
  nextDueDate?: string;
  dueDay?: number;
  maxDaysLate?: number;
  updatedAt: string;
  source: BillingSource;
}

export type BillingInvoiceStatus = "OPEN" | "OVERDUE" | "PAID";

export interface BillingInvoice {
  id: string;
  number: string;
  status: BillingInvoiceStatus;
  amount?: number;
  dueDate?: string;
  paidAt?: string;
  daysLate?: number;
  printUrl?: string;
  barcode?: string;
  pixCopyPaste?: string;
  pixUrl?: string;
}

export interface BillingInvoiceList {
  contractId: string;
  invoices: BillingInvoice[];
  updatedAt: string;
  source: BillingSource;
}

export interface ConnectionStatus {
  contractId: string;
  health: ConnectionHealth;
  contractStatus: ContractStatus;
  onu: TechnicalState;
  pon: TechnicalState;
  pppoe: TechnicalState;
  opticalSignal: "NORMAL" | "WEAK" | "LOS" | "UNKNOWN";
  knownIncident: boolean;
  /** Ausente so em dado mock/dev antigo -- toda resposta vinda do SGP real sempre preenche. */
  statusSource?: ConnectionStatusSource;
  existingOpenTicketId?: string;
  updatedAt: string;
  regionIssue?: boolean;
}

export interface Appointment {
  id: string;
  ticketId: string;
  contractId: string;
  date: string;
  windowStart: string;
  windowEnd: string;
  addressLine: string;
  city: string;
  state: string;
}

export interface TicketTimelineEvent {
  id: string;
  status: TicketStatus;
  title: string;
  occurredAt: string;
  description?: string;
}

export interface TicketSummary {
  id: string;
  protocol: string;
  contractId: string;
  status: TicketStatus;
  statusInterno?: TicketInternalStatus;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  appointment?: Appointment;
}

export interface PublicTicketVisit {
  id: string;
  protocol: string;
  contractId: string;
  status: TicketStatus;
  statusInterno?: TicketInternalStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
  appointment: Appointment | undefined;
  connectionStatus?: "ONLINE" | "OFFLINE";
  /** So preenchido quando o chamado esta fechado: motivo/nota de encerramento registrado no SGP. */
  closureReason?: string;
}

export interface SupportCategory {
  id: DiagnosisCategoryId;
  title: string;
  description: string;
}

export const diagnosisCategoryIds = [
  "no_internet",
  "slow_internet",
  "intermittent",
  "wifi_problem",
  "router_password",
  "websites",
  "equipment",
  "phone",
  "other"
] as const;

export type DiagnosisCategoryId = (typeof diagnosisCategoryIds)[number];

export interface DiagnosisOption {
  id: string;
  label: string;
  value: string;
}

export interface DiagnosisQuestion {
  id: string;
  text: string;
  helperText?: string;
  inputType?: "choice" | "text" | "password";
  options: DiagnosisOption[];
}

export interface DiagnosisSummaryLine {
  label: string;
  value: string;
}

export interface DiagnosisResult {
  state: "QUESTION" | "SUMMARY" | "BLOCKED";
  categoryId: DiagnosisCategoryId;
  question?: DiagnosisQuestion;
  summary?: DiagnosisSummaryLine[];
  classification?: string;
  customerMessage?: string;
  canOpenTicket: boolean;
  duplicateTicketId?: string;
  structuredDescription?: string;
}
