import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

/**
 * Solicitacoes de Contratacao Online (/api/contratacao). Modulo proprio,
 * separado de plan_leads (aba "Leads"): aqui o preco vem do catalogo do
 * servidor, ha protocolo para o interessado, idempotencia, responsavel e
 * historico de eventos (contract_request_events).
 */
export const CONTRACT_REQUEST_STATUSES = [
  "novo",
  "em_analise",
  "sem_cobertura",
  "em_atendimento",
  "agendado",
  "contratado",
  "cancelado"
] as const;
export type ContractRequestStatus = (typeof CONTRACT_REQUEST_STATUSES)[number];

export const CONTRACT_REQUEST_PERIODS = ["manha", "tarde", "noite", "qualquer"] as const;

export const CONTRACT_REQUEST_EVENT_TYPES = ["created", "status_changed", "assigned", "note"] as const;
export type ContractRequestEventType = (typeof CONTRACT_REQUEST_EVENT_TYPES)[number];

export interface ContractRequestSummary {
  id: number;
  protocol: string;
  status: ContractRequestStatus;
  planId: string;
  planName: string;
  planPriceText: string;
  customerName: string;
  whatsapp: string;
  district: string;
  city: string;
  uf: string | null;
  cityCovered: boolean;
  contactPeriod: string | null;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractRequestDetail extends ContractRequestSummary {
  planPriceCents: number;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  email: string | null;
  notes: string | null;
  marketingOptIn: boolean;
  privacyNoticeVersion: string;
  privacyNoticeAckAt: Date;
}

export interface ContractRequestEvent {
  id: number;
  type: ContractRequestEventType;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  adminId: string | null;
  adminName: string | null;
  createdAt: Date;
}

export interface CreateContractRequestInput {
  protocol: string;
  idempotencyKey: string;
  planId: string;
  planName: string;
  planPriceCents: number;
  planPriceText: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  uf: string | null;
  cityCovered: boolean;
  customerName: string;
  whatsapp: string;
  email: string | null;
  contactPeriod: string | null;
  notes: string | null;
  privacyNoticeVersion: string;
  marketingOptIn: boolean;
  ipHash: string | null;
  userAgent: string | null;
}

export interface ContractRequestFilters {
  page: number;
  limit: number;
  status?: string | undefined;
  planId?: string | undefined;
  /** ISO (UTC) inclusivo. */
  fromIso?: string | undefined;
  /** ISO (UTC) exclusivo. */
  toIso?: string | undefined;
  protocol?: string | undefined;
  search?: string | undefined;
}

export interface ContractRequestListResult {
  items: ContractRequestSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface ContractRequestChange {
  status?: ContractRequestStatus | undefined;
  /** undefined = nao mexe; null = remove responsavel. */
  assignedAdminId?: string | null | undefined;
  note?: string | undefined;
}

export interface ContractRequestAssignee {
  id: string;
  name: string;
  email: string;
}

/** Violacao de indice unico -- permite ao chamador reagir (retry de protocolo / replay de idempotencia). */
/** Quem marcou "Quero receber ofertas e novidades" na contratacao online (tela Marketing do admin). */
export interface ContractMarketingLead {
  id: number;
  protocol: string;
  customerName: string;
  email: string | null;
  whatsapp: string;
  city: string;
  planName: string;
  consentAt: Date;
}

export class ContractRequestUniqueViolation extends Error {
  constructor(public readonly field: "protocol" | "idempotency_key") {
    super(`Unique violation on contract_requests.${field}`);
  }
}

export interface ContractRequestRepository {
  /** Grava solicitacao + evento "created". Lanca ContractRequestUniqueViolation em colisao. */
  create(input: CreateContractRequestInput): Promise<ContractRequestDetail>;
  findById(id: number): Promise<ContractRequestDetail | null>;
  findByIdempotencyKey(key: string): Promise<ContractRequestDetail | null>;
  list(filters: ContractRequestFilters): Promise<ContractRequestListResult>;
  listEvents(requestId: number): Promise<ContractRequestEvent[]>;
  /** Aplica as mudancas efetivas e grava um evento por mudanca. Retorna null se nao existir. */
  applyChanges(id: number, change: ContractRequestChange, adminId: string): Promise<ContractRequestDetail | null>;
  countNew(): Promise<number>;
  /** Admins ativos com um dos papeis informados (sem hash de senha, sem role). */
  listAssignees(roles: readonly string[]): Promise<ContractRequestAssignee[]>;
  findAssignee(id: string, roles: readonly string[]): Promise<ContractRequestAssignee | null>;
  /** Solicitacoes com opt-in de marketing, mais recentes primeiro. */
  listMarketingOptIns(limit: number): Promise<ContractMarketingLead[]>;
}

type SqlParam = string | number | null;

interface RequestRow {
  id: number;
  protocol: string;
  status: string;
  plan_id: string;
  plan_name: string;
  plan_price_cents: number;
  plan_price_text: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  uf: string | null;
  city_covered: number;
  customer_name: string;
  whatsapp: string;
  email: string | null;
  contact_period: string | null;
  notes: string | null;
  privacy_notice_version: string;
  privacy_notice_ack_at: string;
  marketing_opt_in: number;
  assigned_admin_id: string | null;
  assigned_admin_name: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: number;
  type: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  admin_id: string | null;
  admin_name: string | null;
  created_at: string;
}

interface CountRow {
  value: number;
}

interface MarketingRow {
  id: number;
  protocol: string;
  customer_name: string;
  email: string | null;
  whatsapp: string;
  city: string;
  plan_name: string;
  created_at: string;
}

interface AssigneeRow {
  id: string;
  name: string;
  email: string;
}

const SELECT_REQUEST = `SELECT r.id, r.protocol, r.status, r.plan_id, r.plan_name, r.plan_price_cents, r.plan_price_text,
  r.cep, r.street, r.number, r.complement, r.district, r.city, r.uf, r.city_covered, r.customer_name, r.whatsapp,
  r.email, r.contact_period, r.notes, r.privacy_notice_version, r.privacy_notice_ack_at, r.marketing_opt_in,
  r.assigned_admin_id, a.name AS assigned_admin_name, r.created_at, r.updated_at
  FROM contract_requests r LEFT JOIN admin_users a ON a.id = r.assigned_admin_id`;

// O consentimento e dado no proprio envio, entao created_at e a data do opt-in.
const SELECT_MARKETING = `SELECT id, protocol, customer_name, email, whatsapp, city, plan_name, created_at
  FROM contract_requests WHERE marketing_opt_in = 1 ORDER BY created_at DESC, id DESC LIMIT ?`;

function marketingFromRow(row: MarketingRow): ContractMarketingLead {
  return {
    id: Number(row.id),
    protocol: row.protocol,
    customerName: row.customer_name,
    email: row.email,
    whatsapp: row.whatsapp,
    city: row.city,
    planName: row.plan_name,
    consentAt: new Date(row.created_at)
  };
}

const SELECT_EVENTS = `SELECT e.id, e.type, e.from_value, e.to_value, e.note, e.admin_id, a.name AS admin_name, e.created_at
  FROM contract_request_events e LEFT JOIN admin_users a ON a.id = e.admin_id
  WHERE e.request_id = ? ORDER BY e.created_at ASC, e.id ASC`;

const INSERT_REQUEST = `INSERT INTO contract_requests
  (protocol, idempotency_key, status, plan_id, plan_name, plan_price_cents, plan_price_text, cep, street, number, complement,
   district, city, uf, city_covered, customer_name, whatsapp, email, contact_period, notes, privacy_notice_version,
   privacy_notice_ack_at, marketing_opt_in, assigned_admin_id, ip_hash, user_agent, created_at, updated_at)
  VALUES (?, ?, 'novo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`;

const INSERT_EVENT = `INSERT INTO contract_request_events (request_id, type, from_value, to_value, note, admin_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

function rolePlaceholders(roles: readonly string[]) {
  // Lista vazia nunca casa (IN () e invalido em SQL).
  return roles.length ? roles.map(() => "?").join(", ") : "NULL";
}

function selectAssignees(roles: readonly string[]) {
  return `SELECT id, name, email FROM admin_users WHERE active = 1 AND role IN (${rolePlaceholders(roles)}) ORDER BY name ASC`;
}

function selectAssignee(roles: readonly string[]) {
  return `SELECT id, name, email FROM admin_users WHERE active = 1 AND role IN (${rolePlaceholders(roles)}) AND id = ?`;
}

function iso(value: Date) {
  return value.toISOString();
}

function cut(value: string | null | undefined, length: number) {
  return value ? value.slice(0, length) : null;
}

function fromRow(row: RequestRow): ContractRequestDetail {
  return {
    id: Number(row.id),
    protocol: row.protocol,
    status: row.status as ContractRequestStatus,
    planId: row.plan_id,
    planName: row.plan_name,
    planPriceCents: Number(row.plan_price_cents),
    planPriceText: row.plan_price_text,
    cep: row.cep,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    uf: row.uf,
    cityCovered: Boolean(Number(row.city_covered)),
    customerName: row.customer_name,
    whatsapp: row.whatsapp,
    email: row.email,
    contactPeriod: row.contact_period,
    notes: row.notes,
    privacyNoticeVersion: row.privacy_notice_version,
    privacyNoticeAckAt: new Date(row.privacy_notice_ack_at),
    marketingOptIn: Boolean(Number(row.marketing_opt_in)),
    assignedAdminId: row.assigned_admin_id,
    assignedAdminName: row.assigned_admin_name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/** Lista nao carrega endereco completo, e-mail nem observacoes -- so o necessario pra triagem. */
export function toSummary(detail: ContractRequestDetail): ContractRequestSummary {
  return {
    id: detail.id,
    protocol: detail.protocol,
    status: detail.status,
    planId: detail.planId,
    planName: detail.planName,
    planPriceText: detail.planPriceText,
    customerName: detail.customerName,
    whatsapp: detail.whatsapp,
    district: detail.district,
    city: detail.city,
    uf: detail.uf,
    cityCovered: detail.cityCovered,
    contactPeriod: detail.contactPeriod,
    assignedAdminId: detail.assignedAdminId,
    assignedAdminName: detail.assignedAdminName,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt
  };
}

function eventFromRow(row: EventRow): ContractRequestEvent {
  return {
    id: Number(row.id),
    type: row.type as ContractRequestEventType,
    fromValue: row.from_value,
    toValue: row.to_value,
    note: row.note,
    adminId: row.admin_id,
    adminName: row.admin_name,
    createdAt: new Date(row.created_at)
  };
}

/** Escapa curingas do LIKE (usa "!" como escape: funciona igual em SQLite e MySQL). */
function likeValue(value: string) {
  return `%${value.replace(/[!%_]/g, (char) => `!${char}`)}%`;
}

function buildWhere(filters: ContractRequestFilters) {
  const clauses: string[] = [];
  const params: SqlParam[] = [];

  if (filters.status) {
    clauses.push("r.status = ?");
    params.push(filters.status);
  }
  if (filters.planId) {
    clauses.push("r.plan_id = ?");
    params.push(filters.planId);
  }
  if (filters.fromIso) {
    clauses.push("r.created_at >= ?");
    params.push(filters.fromIso);
  }
  if (filters.toIso) {
    clauses.push("r.created_at < ?");
    params.push(filters.toIso);
  }
  if (filters.protocol) {
    clauses.push("r.protocol = ?");
    params.push(filters.protocol);
  }
  if (filters.search) {
    const parts = ["r.customer_name LIKE ? ESCAPE '!'", "r.city LIKE ? ESCAPE '!'"];
    const text = likeValue(filters.search);
    params.push(text, text);
    // WhatsApp e gravado so com digitos: "(11) 9888" tambem precisa achar.
    const digits = filters.search.replace(/\D/g, "");
    if (digits.length >= 3) {
      parts.push("r.whatsapp LIKE ? ESCAPE '!'");
      params.push(likeValue(digits));
    }
    clauses.push(`(${parts.join(" OR ")})`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function insertValues(input: CreateContractRequestInput, nowIso: string): SqlParam[] {
  return [
    input.protocol,
    input.idempotencyKey,
    input.planId.slice(0, 40),
    input.planName.slice(0, 120),
    input.planPriceCents,
    input.planPriceText.slice(0, 40),
    input.cep.slice(0, 9),
    input.street.slice(0, 255),
    input.number.slice(0, 20),
    cut(input.complement, 120),
    input.district.slice(0, 120),
    input.city.slice(0, 120),
    cut(input.uf, 2),
    input.cityCovered ? 1 : 0,
    input.customerName.slice(0, 120),
    input.whatsapp.slice(0, 11),
    cut(input.email, 254),
    cut(input.contactPeriod, 20),
    cut(input.notes, 500),
    input.privacyNoticeVersion.slice(0, 32),
    nowIso,
    input.marketingOptIn ? 1 : 0,
    input.ipHash,
    cut(input.userAgent, 500),
    nowIso,
    nowIso
  ];
}

function uniqueViolation(error: unknown): ContractRequestUniqueViolation | null {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code;
  const isUnique = /UNIQUE constraint failed|Duplicate entry/i.test(message) || code === "ER_DUP_ENTRY";
  if (!isUnique) return null;
  if (/idempotency/i.test(message)) return new ContractRequestUniqueViolation("idempotency_key");
  if (/protocol/i.test(message)) return new ContractRequestUniqueViolation("protocol");
  return null;
}

interface PlannedEvent {
  type: ContractRequestEventType;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
}

/** So mudancas efetivas viram evento (status igual ao atual nao gera historico). */
function planChanges(existing: ContractRequestDetail, change: ContractRequestChange) {
  const events: PlannedEvent[] = [];
  let status = existing.status;
  let assigned = existing.assignedAdminId;

  if (change.status !== undefined && change.status !== existing.status) {
    events.push({ type: "status_changed", fromValue: existing.status, toValue: change.status, note: null });
    status = change.status;
  }
  if (change.assignedAdminId !== undefined && change.assignedAdminId !== existing.assignedAdminId) {
    events.push({ type: "assigned", fromValue: existing.assignedAdminId, toValue: change.assignedAdminId, note: null });
    assigned = change.assignedAdminId;
  }
  if (change.note !== undefined && change.note.trim()) {
    events.push({ type: "note", fromValue: null, toValue: null, note: change.note.trim().slice(0, 2000) });
  }
  return { events, status, assigned };
}

export class SqliteContractRequestRepository implements ContractRequestRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(input: CreateContractRequestInput): Promise<ContractRequestDetail> {
    const nowIso = iso(new Date());
    let id: number;
    this.db.exec("BEGIN");
    try {
      const result = this.db.prepare(INSERT_REQUEST).run(...insertValues(input, nowIso));
      id = Number(result.lastInsertRowid);
      this.db.prepare(INSERT_EVENT).run(id, "created", null, "novo", null, null, nowIso);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw uniqueViolation(error) ?? error;
    }
    const created = await this.findById(id);
    if (!created) throw new Error("Failed to create contract request.");
    return created;
  }

  async findById(id: number): Promise<ContractRequestDetail | null> {
    const row = this.db.prepare(`${SELECT_REQUEST} WHERE r.id = ?`).get(id) as RequestRow | undefined;
    return row ? fromRow(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<ContractRequestDetail | null> {
    const row = this.db.prepare(`${SELECT_REQUEST} WHERE r.idempotency_key = ?`).get(key) as RequestRow | undefined;
    return row ? fromRow(row) : null;
  }

  async list(filters: ContractRequestFilters): Promise<ContractRequestListResult> {
    const { where, params } = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;
    const totalRow = this.db.prepare(`SELECT COUNT(*) AS value FROM contract_requests r ${where}`).get(...params) as
      | CountRow
      | undefined;
    const rows = this.db
      .prepare(`${SELECT_REQUEST} ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`)
      .all(...params, filters.limit, offset) as unknown as RequestRow[];
    return {
      items: rows.map((row) => toSummary(fromRow(row))),
      page: filters.page,
      limit: filters.limit,
      total: Number(totalRow?.value ?? 0)
    };
  }

  async listEvents(requestId: number): Promise<ContractRequestEvent[]> {
    const rows = this.db.prepare(SELECT_EVENTS).all(requestId) as unknown as EventRow[];
    return rows.map(eventFromRow);
  }

  async applyChanges(id: number, change: ContractRequestChange, adminId: string): Promise<ContractRequestDetail | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const { events, status, assigned } = planChanges(existing, change);
    if (events.length === 0) return existing;

    const nowIso = iso(new Date());
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("UPDATE contract_requests SET status = ?, assigned_admin_id = ?, updated_at = ? WHERE id = ?")
        .run(status, assigned, nowIso, id);
      const insert = this.db.prepare(INSERT_EVENT);
      for (const event of events) {
        insert.run(id, event.type, event.fromValue, event.toValue, event.note, adminId, nowIso);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.findById(id);
  }

  async countNew(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) AS value FROM contract_requests WHERE status = 'novo'").get() as
      | CountRow
      | undefined;
    return Number(row?.value ?? 0);
  }

  async listAssignees(roles: readonly string[]): Promise<ContractRequestAssignee[]> {
    const rows = this.db.prepare(selectAssignees(roles)).all(...roles) as unknown as AssigneeRow[];
    return rows.map((row) => ({ id: row.id, name: row.name, email: row.email }));
  }

  async findAssignee(id: string, roles: readonly string[]): Promise<ContractRequestAssignee | null> {
    const row = this.db.prepare(selectAssignee(roles)).get(...roles, id) as AssigneeRow | undefined;
    return row ? { id: row.id, name: row.name, email: row.email } : null;
  }

  async listMarketingOptIns(limit: number): Promise<ContractMarketingLead[]> {
    const rows = this.db.prepare(SELECT_MARKETING).all(limit) as unknown as MarketingRow[];
    return rows.map(marketingFromRow);
  }
}

export class MysqlContractRequestRepository implements ContractRequestRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateContractRequestInput): Promise<ContractRequestDetail> {
    const nowIso = iso(new Date());
    const connection = await this.pool.getConnection();
    let id: number;
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(INSERT_REQUEST, insertValues(input, nowIso));
      id = Number((result as { insertId?: number }).insertId);
      await connection.execute(INSERT_EVENT, [id, "created", null, "novo", null, null, nowIso]);
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw uniqueViolation(error) ?? error;
    } finally {
      connection.release();
    }
    const created = await this.findById(id);
    if (!created) throw new Error("Failed to create contract request.");
    return created;
  }

  async findById(id: number): Promise<ContractRequestDetail | null> {
    const [rows] = await this.pool.execute(`${SELECT_REQUEST} WHERE r.id = ?`, [id]);
    const row = (rows as RequestRow[])[0];
    return row ? fromRow(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<ContractRequestDetail | null> {
    const [rows] = await this.pool.execute(`${SELECT_REQUEST} WHERE r.idempotency_key = ?`, [key]);
    const row = (rows as RequestRow[])[0];
    return row ? fromRow(row) : null;
  }

  async list(filters: ContractRequestFilters): Promise<ContractRequestListResult> {
    const { where, params } = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;
    const [countRows] = await this.pool.execute(`SELECT COUNT(*) AS value FROM contract_requests r ${where}`, params);
    const [rows] = await this.pool.execute(
      `${SELECT_REQUEST} ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
      [...params, filters.limit, offset]
    );
    return {
      items: (rows as RequestRow[]).map((row) => toSummary(fromRow(row))),
      page: filters.page,
      limit: filters.limit,
      total: Number((countRows as CountRow[])[0]?.value ?? 0)
    };
  }

  async listEvents(requestId: number): Promise<ContractRequestEvent[]> {
    const [rows] = await this.pool.execute(SELECT_EVENTS, [requestId]);
    return (rows as EventRow[]).map(eventFromRow);
  }

  async applyChanges(id: number, change: ContractRequestChange, adminId: string): Promise<ContractRequestDetail | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const { events, status, assigned } = planChanges(existing, change);
    if (events.length === 0) return existing;

    const nowIso = iso(new Date());
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("UPDATE contract_requests SET status = ?, assigned_admin_id = ?, updated_at = ? WHERE id = ?", [
        status,
        assigned,
        nowIso,
        id
      ]);
      for (const event of events) {
        await connection.execute(INSERT_EVENT, [id, event.type, event.fromValue, event.toValue, event.note, adminId, nowIso]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
    return this.findById(id);
  }

  async countNew(): Promise<number> {
    const [rows] = await this.pool.execute("SELECT COUNT(*) AS value FROM contract_requests WHERE status = 'novo'");
    return Number((rows as CountRow[])[0]?.value ?? 0);
  }

  async listAssignees(roles: readonly string[]): Promise<ContractRequestAssignee[]> {
    const [rows] = await this.pool.execute(selectAssignees(roles), [...roles]);
    return (rows as AssigneeRow[]).map((row) => ({ id: row.id, name: row.name, email: row.email }));
  }

  async findAssignee(id: string, roles: readonly string[]): Promise<ContractRequestAssignee | null> {
    const [rows] = await this.pool.execute(selectAssignee(roles), [...roles, id]);
    const row = (rows as AssigneeRow[])[0];
    return row ? { id: row.id, name: row.name, email: row.email } : null;
  }

  async listMarketingOptIns(limit: number): Promise<ContractMarketingLead[]> {
    const [rows] = await this.pool.execute(SELECT_MARKETING, [limit]);
    return (rows as MarketingRow[]).map(marketingFromRow);
  }
}
