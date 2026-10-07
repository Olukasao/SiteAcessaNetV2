import type {
  Appointment,
  ConnectionStatus,
  ContractSummary,
  DiagnosisCategoryId,
  DiagnosisResult,
  TicketStatus,
  TicketSummary,
  TicketTimelineEvent
} from "../types.js";
import { maskCpf, maskEmail, maskPhone, normalizeCpf } from "../auth/cpf.js";
import { randomId, sha256 } from "../security/hash.js";

export interface CustomerRecord {
  id: string;
  name: string;
  cpfHash: string;
  maskedCpf: string;
  phone: string;
  maskedPhone: string;
  /** Vazio quando o SGP nao tem e-mail cadastrado para o cliente. */
  email: string;
  maskedEmail: string;
}

export interface DiagnosisRecord {
  id: string;
  customerId: string;
  contractId: string;
  categoryId: DiagnosisCategoryId;
  answers: Record<string, string>;
  result: DiagnosisResult;
  createdAt: string;
}

export interface TicketRecord extends TicketSummary {
  customerId: string;
  diagnosisId?: string;
  sgpTicketId: string;
  description: string;
  timeline: TicketTimelineEvent[];
}

export interface AuditEventRecord {
  id: string;
  type:
    | "AUTH_REQUESTED"
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "TICKET_CREATED"
    | "TICKET_VIEWED"
    | "APPOINTMENT_VIEWED"
    | "SESSION_REVOKED";
  customerId?: string;
  metadata?: Record<string, string | number | boolean>;
  occurredAt: string;
}

/**
 * Cache em memoria de dados que vem do SGP a cada login/consulta (clientes,
 * contratos, diagnosticos, chamados). Nao precisa sobreviver a um restart:
 * o cliente reautentica e os dados voltam do SGP. O que realmente precisa
 * de persistencia duravel (senha, sessao, tentativas de login, auditoria de
 * autenticacao) fica no SQLite (ver repositories/sqlite.ts e os repos
 * auth*Repository).
 */
export class InMemoryStore {
  readonly customers = new Map<string, CustomerRecord>();
  readonly contracts = new Map<string, ContractSummary>();
  readonly connectionStatuses = new Map<string, ConnectionStatus>();
  readonly diagnoses = new Map<string, DiagnosisRecord>();
  readonly tickets = new Map<string, TicketRecord>();
  readonly auditEvents: AuditEventRecord[] = [];

  findCustomerByCpf(cpf: string) {
    const cpfHash = sha256(normalizeCpf(cpf));
    return [...this.customers.values()].find((customer) => customer.cpfHash === cpfHash);
  }

  upsertCustomer(input: { id: string; name: string; cpf: string; phone: string; email?: string | undefined }) {
    const email = input.email ?? "";
    const customer: CustomerRecord = {
      id: input.id,
      name: input.name,
      cpfHash: sha256(normalizeCpf(input.cpf)),
      maskedCpf: maskCpf(input.cpf),
      phone: input.phone,
      maskedPhone: maskPhone(input.phone),
      email,
      maskedEmail: email ? maskEmail(email) : ""
    };
    this.customers.set(customer.id, customer);
    return customer;
  }

  getCustomer(customerId: string) {
    return this.customers.get(customerId);
  }

  listContracts(customerId: string) {
    return [...this.contracts.values()].filter((contract) => contract.customerId === customerId);
  }

  getContract(contractId: string) {
    return this.contracts.get(contractId);
  }

  upsertContract(contract: ContractSummary) {
    this.contracts.set(contract.id, contract);
    return contract;
  }

  getConnection(contractId: string) {
    return this.connectionStatuses.get(contractId);
  }

  createDiagnosis(record: Omit<DiagnosisRecord, "id" | "createdAt">) {
    const diagnosis: DiagnosisRecord = {
      ...record,
      id: randomId("diag"),
      createdAt: new Date().toISOString()
    };
    this.diagnoses.set(diagnosis.id, diagnosis);
    return diagnosis;
  }

  createTicket(record: Omit<TicketRecord, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const ticket: TicketRecord = {
      ...record,
      id: randomId("ticket"),
      createdAt: now,
      updatedAt: now
    };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  listTickets(customerId: string) {
    return [...this.tickets.values()].filter((ticket) => ticket.customerId === customerId);
  }

  findOpenTicketByContract(contractId: string) {
    const closed = new Set<TicketStatus>(["RESOLVED", "CANCELED"]);
    return [...this.tickets.values()].find(
      (ticket) => ticket.contractId === contractId && !closed.has(ticket.status)
    );
  }

  updateTicketStatus(ticketId: string, status: TicketStatus, updatedAt = new Date().toISOString()) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return undefined;
    }

    const updated = { ...ticket, status, updatedAt };
    this.tickets.set(ticketId, updated);
    return updated;
  }

  recordAudit(event: Omit<AuditEventRecord, "id" | "occurredAt">) {
    this.auditEvents.push({
      ...event,
      id: randomId("audit"),
      occurredAt: new Date().toISOString()
    });
  }
}

export type { Appointment };
