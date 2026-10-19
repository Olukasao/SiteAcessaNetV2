import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

/**
 * Pedidos de assinatura feitos pelo site ("Quero este plano"). Antes iam
 * direto pro WhatsApp sem registro; aqui cada pedido fica salvo e aparece no
 * admin, aba "Leads", pro comercial acompanhar ate a contratacao.
 */
export const PLAN_LEAD_STATUSES = ["novo", "em_contato", "contratado", "sem_viabilidade", "perdido"] as const;
export type PlanLeadStatus = (typeof PLAN_LEAD_STATUSES)[number];

export const PLAN_LEAD_PERIODS = ["manha", "tarde", "noite", "qualquer"] as const;

export interface PlanLeadRecord {
  id: number;
  planId: string;
  planName: string;
  planPrice: string | null;
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string | null;
  city: string;
  uf: string | null;
  contactPeriod: string | null;
  coverageOk: boolean;
  status: PlanLeadStatus;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanLeadInput {
  planId: string;
  planName: string;
  planPrice?: string | null | undefined;
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string | null | undefined;
  district?: string | null | undefined;
  city: string;
  uf?: string | null | undefined;
  contactPeriod?: string | null | undefined;
  coverageOk: boolean;
  ipHash?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface PlanLeadFilters {
  page: number;
  limit: number;
  status?: string | undefined;
  planId?: string | undefined;
  city?: string | undefined;
  search?: string | undefined;
}

export interface PlanLeadListResult {
  items: PlanLeadRecord[];
  page: number;
  limit: number;
  total: number;
}

export interface UpdatePlanLeadInput {
  id: number;
  status?: PlanLeadStatus | undefined;
  adminNotes?: string | null | undefined;
}

export interface PlanLeadRepository {
  create(input: CreatePlanLeadInput): Promise<PlanLeadRecord>;
  findById(id: number): Promise<PlanLeadRecord | null>;
  list(filters: PlanLeadFilters): Promise<PlanLeadListResult>;
  update(input: UpdatePlanLeadInput): Promise<PlanLeadRecord | null>;
  countNew(): Promise<number>;
}

type SqlParam = string | number | null;

interface PlanLeadRow {
  id: number;
  plan_id: string;
  plan_name: string;
  plan_price: string | null;
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string | null;
  city: string;
  uf: string | null;
  contact_period: string | null;
  coverage_ok: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  value: number;
}

const COLUMNS =
  "id, plan_id, plan_name, plan_price, name, phone, cep, street, number, complement, district, city, uf, contact_period, coverage_ok, status, admin_notes, created_at, updated_at";

function iso(value: Date) {
  return value.toISOString();
}

function cut(value: string | null | undefined, length: number) {
  return value ? value.slice(0, length) : null;
}

function fromRow(row: PlanLeadRow): PlanLeadRecord {
  return {
    id: Number(row.id),
    planId: row.plan_id,
    planName: row.plan_name,
    planPrice: row.plan_price,
    name: row.name,
    phone: row.phone,
    cep: row.cep,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    uf: row.uf,
    contactPeriod: row.contact_period,
    coverageOk: Boolean(Number(row.coverage_ok)),
    status: row.status as PlanLeadStatus,
    adminNotes: row.admin_notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function buildWhere(filters: PlanLeadFilters) {
  const clauses: string[] = [];
  const params: SqlParam[] = [];

  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters.planId) {
    clauses.push("plan_id = ?");
    params.push(filters.planId);
  }
  if (filters.city) {
    clauses.push("city = ?");
    params.push(filters.city);
  }
  if (filters.search) {
    clauses.push("(name LIKE ? OR phone LIKE ? OR cep LIKE ? OR street LIKE ? OR district LIKE ?)");
    const value = `%${filters.search}%`;
    params.push(value, value, value, value, value);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const INSERT_SQL = `INSERT INTO plan_leads
  (plan_id, plan_name, plan_price, name, phone, cep, street, number, complement, district, city, uf, contact_period, coverage_ok, status, ip_hash, user_agent, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function insertValues(input: CreatePlanLeadInput): SqlParam[] {
  const now = iso(new Date());
  return [
    input.planId.slice(0, 40),
    input.planName.slice(0, 120),
    cut(input.planPrice, 40),
    input.name.slice(0, 200),
    input.phone.slice(0, 40),
    input.cep.slice(0, 12),
    input.street.slice(0, 255),
    input.number.slice(0, 20),
    cut(input.complement, 120),
    cut(input.district, 120),
    input.city.slice(0, 120),
    cut(input.uf, 4),
    cut(input.contactPeriod, 20),
    input.coverageOk ? 1 : 0,
    "novo",
    input.ipHash ?? null,
    cut(input.userAgent, 500),
    now,
    now
  ];
}

export class SqlitePlanLeadRepository implements PlanLeadRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(input: CreatePlanLeadInput): Promise<PlanLeadRecord> {
    const result = this.db.prepare(INSERT_SQL).run(...insertValues(input));
    const created = await this.findById(Number(result.lastInsertRowid));
    if (!created) throw new Error("Failed to create plan lead.");
    return created;
  }

  async findById(id: number): Promise<PlanLeadRecord | null> {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM plan_leads WHERE id = ?`).get(id) as PlanLeadRow | undefined;
    return row ? fromRow(row) : null;
  }

  async list(filters: PlanLeadFilters): Promise<PlanLeadListResult> {
    const { where, params } = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;
    const totalRow = this.db.prepare(`SELECT COUNT(*) AS value FROM plan_leads ${where}`).get(...params) as CountRow | undefined;
    const rows = this.db
      .prepare(`SELECT ${COLUMNS} FROM plan_leads ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, filters.limit, offset) as unknown as PlanLeadRow[];
    return { items: rows.map(fromRow), page: filters.page, limit: filters.limit, total: Number(totalRow?.value ?? 0) };
  }

  async update(input: UpdatePlanLeadInput): Promise<PlanLeadRecord | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const status = input.status ?? existing.status;
    const notes = input.adminNotes === undefined ? existing.adminNotes : input.adminNotes;
    this.db
      .prepare("UPDATE plan_leads SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?")
      .run(status, notes ?? null, iso(new Date()), input.id);
    return this.findById(input.id);
  }

  async countNew(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) AS value FROM plan_leads WHERE status = 'novo'").get() as CountRow | undefined;
    return Number(row?.value ?? 0);
  }
}

export class MysqlPlanLeadRepository implements PlanLeadRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreatePlanLeadInput): Promise<PlanLeadRecord> {
    const [result] = await this.pool.execute(INSERT_SQL, insertValues(input));
    const created = await this.findById(Number((result as { insertId?: number }).insertId));
    if (!created) throw new Error("Failed to create plan lead.");
    return created;
  }

  async findById(id: number): Promise<PlanLeadRecord | null> {
    const [rows] = await this.pool.execute(`SELECT ${COLUMNS} FROM plan_leads WHERE id = ?`, [id]);
    const row = (rows as PlanLeadRow[])[0];
    return row ? fromRow(row) : null;
  }

  async list(filters: PlanLeadFilters): Promise<PlanLeadListResult> {
    const { where, params } = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;
    const [countRows] = await this.pool.execute(`SELECT COUNT(*) AS value FROM plan_leads ${where}`, params);
    const [rows] = await this.pool.execute(
      `SELECT ${COLUMNS} FROM plan_leads ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, filters.limit, offset]
    );
    return {
      items: (rows as PlanLeadRow[]).map(fromRow),
      page: filters.page,
      limit: filters.limit,
      total: Number((countRows as CountRow[])[0]?.value ?? 0)
    };
  }

  async update(input: UpdatePlanLeadInput): Promise<PlanLeadRecord | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const status = input.status ?? existing.status;
    const notes = input.adminNotes === undefined ? existing.adminNotes : input.adminNotes;
    await this.pool.execute("UPDATE plan_leads SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?", [
      status,
      notes ?? null,
      iso(new Date()),
      input.id
    ]);
    return this.findById(input.id);
  }

  async countNew(): Promise<number> {
    const [rows] = await this.pool.execute("SELECT COUNT(*) AS value FROM plan_leads WHERE status = 'novo'");
    return Number((rows as CountRow[])[0]?.value ?? 0);
  }
}
