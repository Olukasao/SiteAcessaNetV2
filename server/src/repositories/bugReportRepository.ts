import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export const BUG_REPORT_STATUSES = ["novo", "analisando", "corrigido", "ignorado"] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export const BUG_REPORT_CATEGORIES = [
  "Dados incorretos",
  "Status da conexão",
  "Faturas / boletos",
  "Contratos",
  "Chamados",
  "Login",
  "Interface / visual",
  "Lentidão",
  "Erro ao carregar página",
  "Outro"
] as const;
export type BugReportCategory = (typeof BUG_REPORT_CATEGORIES)[number];

export interface BugReportRecord {
  id: number;
  customerId: string;
  cpfHash: string | null;
  cpfMasked: string | null;
  customerName: string | null;
  sgpCustomerId: string | null;
  contractId: string | null;
  category: string;
  description: string;
  page: string | null;
  url: string | null;
  userAgent: string | null;
  frontendVersion: string | null;
  context: Record<string, unknown> | null;
  status: BugReportStatus;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BugReportHistoryEntry {
  id: number;
  reportId: number;
  adminUserId: string | null;
  adminEmail: string | null;
  action: string;
  beforeStatus: BugReportStatus | null;
  afterStatus: BugReportStatus | null;
  beforeNotes: string | null;
  afterNotes: string | null;
  createdAt: Date;
}

export interface CreateBugReportInput {
  customerId: string;
  cpfHash?: string | null | undefined;
  cpfMasked?: string | null | undefined;
  customerName?: string | null | undefined;
  sgpCustomerId?: string | null | undefined;
  contractId?: string | null | undefined;
  category: string;
  description: string;
  page?: string | null | undefined;
  url?: string | null | undefined;
  userAgent?: string | null | undefined;
  frontendVersion?: string | null | undefined;
  context?: Record<string, unknown> | null | undefined;
  when?: Date | undefined;
}

export interface BugReportFilters {
  page: number;
  limit: number;
  status?: string | undefined;
  category?: string | undefined;
  customer?: string | undefined;
  contractId?: string | undefined;
  search?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface BugReportListResult {
  items: BugReportRecord[];
  page: number;
  limit: number;
  total: number;
}

export interface UpdateBugReportInput {
  id: number;
  status?: BugReportStatus | undefined;
  adminNotes?: string | null | undefined;
  adminUserId?: string | null | undefined;
  adminEmail?: string | null | undefined;
}

export interface BugReportSummary {
  newCount: number;
  byStatus: Array<{ status: string; total: number }>;
}

export interface BugReportRepository {
  create(input: CreateBugReportInput): Promise<BugReportRecord>;
  findById(id: number): Promise<BugReportRecord | null>;
  list(filters: BugReportFilters): Promise<BugReportListResult>;
  updateAdmin(input: UpdateBugReportInput): Promise<BugReportRecord>;
  listHistory(reportId: number): Promise<BugReportHistoryEntry[]>;
  summary(): Promise<BugReportSummary>;
}

type SqlParam = string | number | null;

interface BugReportRow {
  id: number;
  customer_id: string;
  cpf_hash: string | null;
  cpf_masked: string | null;
  customer_name: string | null;
  sgp_customer_id: string | null;
  contract_id: string | null;
  category: string;
  description: string;
  page: string | null;
  url: string | null;
  user_agent: string | null;
  frontend_version: string | null;
  context_json: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BugReportHistoryRow {
  id: number;
  report_id: number;
  admin_user_id: string | null;
  admin_email: string | null;
  action: string;
  before_status: string | null;
  after_status: string | null;
  before_notes: string | null;
  after_notes: string | null;
  created_at: string;
}

interface CountRow {
  value: number;
}

interface StatusCountRow {
  status: string;
  total: number;
}

function iso(value: Date) {
  return value.toISOString();
}

function clamp(value: string | null | undefined, length: number) {
  if (!value) return null;
  return value.slice(0, length);
}

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function fromReportRow(row: BugReportRow): BugReportRecord {
  return {
    id: Number(row.id),
    customerId: row.customer_id,
    cpfHash: row.cpf_hash,
    cpfMasked: row.cpf_masked,
    customerName: row.customer_name,
    sgpCustomerId: row.sgp_customer_id,
    contractId: row.contract_id,
    category: row.category,
    description: row.description,
    page: row.page,
    url: row.url,
    userAgent: row.user_agent,
    frontendVersion: row.frontend_version,
    context: parseJson(row.context_json),
    status: row.status as BugReportStatus,
    adminNotes: row.admin_notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function fromHistoryRow(row: BugReportHistoryRow): BugReportHistoryEntry {
  return {
    id: Number(row.id),
    reportId: Number(row.report_id),
    adminUserId: row.admin_user_id,
    adminEmail: row.admin_email,
    action: row.action,
    beforeStatus: row.before_status as BugReportStatus | null,
    afterStatus: row.after_status as BugReportStatus | null,
    beforeNotes: row.before_notes,
    afterNotes: row.after_notes,
    createdAt: new Date(row.created_at)
  };
}

function buildWhere(filters: BugReportFilters) {
  const clauses: string[] = [];
  const params: SqlParam[] = [];

  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters.category) {
    clauses.push("category = ?");
    params.push(filters.category);
  }
  if (filters.contractId) {
    clauses.push("contract_id = ?");
    params.push(filters.contractId);
  }
  if (filters.customer) {
    clauses.push("(customer_name LIKE ? OR customer_id LIKE ? OR sgp_customer_id LIKE ? OR cpf_masked LIKE ?)");
    params.push(`%${filters.customer}%`, `%${filters.customer}%`, `%${filters.customer}%`, `%${filters.customer}%`);
  }
  if (filters.search) {
    clauses.push("(customer_name LIKE ? OR customer_id LIKE ? OR sgp_customer_id LIKE ? OR contract_id LIKE ? OR description LIKE ? OR category LIKE ?)");
    const value = `%${filters.search}%`;
    params.push(value, value, value, value, value, value);
  }
  if (filters.from) {
    clauses.push("created_at >= ?");
    params.push(iso(filters.from));
  }
  if (filters.to) {
    clauses.push("created_at < ?");
    params.push(iso(filters.to));
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function reportInsertValues(input: CreateBugReportInput) {
  const when = input.when ?? new Date();
  return [
    input.customerId,
    input.cpfHash ?? null,
    input.cpfMasked ?? null,
    clamp(input.customerName, 255),
    input.sgpCustomerId ?? null,
    input.contractId ?? null,
    clamp(input.category, 100),
    input.description,
    clamp(input.page, 500),
    clamp(input.url, 2048),
    clamp(input.userAgent, 500),
    clamp(input.frontendVersion, 100),
    input.context ? JSON.stringify(input.context) : null,
    "novo",
    iso(when),
    iso(when)
  ];
}

export class SqliteBugReportRepository implements BugReportRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(input: CreateBugReportInput): Promise<BugReportRecord> {
    const result = this.db
      .prepare(
        `INSERT INTO bug_reports
          (customer_id, cpf_hash, cpf_masked, customer_name, sgp_customer_id, contract_id, category, description, page, url, user_agent, frontend_version, context_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...reportInsertValues(input));

    const created = await this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error("Failed to create bug report.");
    }
    return created;
  }

  async findById(id: number): Promise<BugReportRecord | null> {
    const row = this.db.prepare("SELECT * FROM bug_reports WHERE id = ?").get(id) as BugReportRow | undefined;
    return row ? fromReportRow(row) : null;
  }

  async list(filters: BugReportFilters): Promise<BugReportListResult> {
    const { where, params } = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;
    const totalRow = this.db.prepare(`SELECT COUNT(*) AS value FROM bug_reports ${where}`).get(...params) as CountRow | undefined;
    const rows = this.db
      .prepare(`SELECT * FROM bug_reports ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, filters.limit, offset) as unknown as BugReportRow[];

    return { items: rows.map(fromReportRow), page: filters.page, limit: filters.limit, total: Number(totalRow?.value ?? 0) };
  }

  async updateAdmin(input: UpdateBugReportInput): Promise<BugReportRecord> {
    const existing = await this.findById(input.id);
    if (!existing) {
      throw new Error("Bug report not found.");
    }

    const nextStatus = input.status ?? existing.status;
    const nextNotes = input.adminNotes === undefined ? existing.adminNotes : input.adminNotes;
    const action = input.status && input.status !== existing.status ? "STATUS_CHANGED" : "NOTES_UPDATED";
    const now = iso(new Date());

    this.db
      .prepare("UPDATE bug_reports SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?")
      .run(nextStatus, nextNotes ?? null, now, input.id);
    this.db
      .prepare(
        `INSERT INTO bug_report_history
          (report_id, admin_user_id, admin_email, action, before_status, after_status, before_notes, after_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.adminUserId ?? null,
        input.adminEmail ?? null,
        action,
        existing.status,
        nextStatus,
        existing.adminNotes,
        nextNotes ?? null,
        now
      );

    const updated = await this.findById(input.id);
    if (!updated) {
      throw new Error("Failed to update bug report.");
    }
    return updated;
  }

  async listHistory(reportId: number): Promise<BugReportHistoryEntry[]> {
    const rows = this.db
      .prepare("SELECT * FROM bug_report_history WHERE report_id = ? ORDER BY created_at DESC, id DESC")
      .all(reportId) as unknown as BugReportHistoryRow[];
    return rows.map(fromHistoryRow);
  }

  async summary(): Promise<BugReportSummary> {
    const newRow = this.db.prepare("SELECT COUNT(*) AS value FROM bug_reports WHERE status = 'novo'").get() as CountRow | undefined;
    const rows = this.db
      .prepare("SELECT status, COUNT(*) AS total FROM bug_reports GROUP BY status ORDER BY status ASC")
      .all() as unknown as StatusCountRow[];
    return {
      newCount: Number(newRow?.value ?? 0),
      byStatus: rows.map((row) => ({ status: row.status, total: Number(row.total) }))
    };
  }
}

export class MysqlBugReportRepository implements BugReportRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBugReportInput): Promise<BugReportRecord> {
    const [result] = await this.pool.execute(
      `INSERT INTO bug_reports
        (customer_id, cpf_hash, cpf_masked, customer_name, sgp_customer_id, contract_id, category, description, page, url, user_agent, frontend_version, context_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      reportInsertValues(input)
    );

    const id = Number((result as { insertId?: number }).insertId);
    const created = await this.findById(id);
    if (!created) {
      throw new Error("Failed to create bug report.");
    }
    return created;
  }

  async findById(id: number): Promise<BugReportRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM bug_reports WHERE id = ?", [id]);
    const row = (rows as BugReportRow[])[0];
    return row ? fromReportRow(row) : null;
  }

  async list(filters: BugReportFilters): Promise<BugReportListResult> {
    const { where, params } = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;
    const [countRows] = await this.pool.execute(`SELECT COUNT(*) AS value FROM bug_reports ${where}`, params);
    const [rows] = await this.pool.execute(
      `SELECT * FROM bug_reports ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, filters.limit, offset]
    );

    return {
      items: (rows as BugReportRow[]).map(fromReportRow),
      page: filters.page,
      limit: filters.limit,
      total: Number((countRows as CountRow[])[0]?.value ?? 0)
    };
  }

  async updateAdmin(input: UpdateBugReportInput): Promise<BugReportRecord> {
    const existing = await this.findById(input.id);
    if (!existing) {
      throw new Error("Bug report not found.");
    }

    const nextStatus = input.status ?? existing.status;
    const nextNotes = input.adminNotes === undefined ? existing.adminNotes : input.adminNotes;
    const action = input.status && input.status !== existing.status ? "STATUS_CHANGED" : "NOTES_UPDATED";
    const now = iso(new Date());

    await this.pool.execute("UPDATE bug_reports SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?", [
      nextStatus,
      nextNotes ?? null,
      now,
      input.id
    ]);
    await this.pool.execute(
      `INSERT INTO bug_report_history
        (report_id, admin_user_id, admin_email, action, before_status, after_status, before_notes, after_notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.adminUserId ?? null,
        input.adminEmail ?? null,
        action,
        existing.status,
        nextStatus,
        existing.adminNotes,
        nextNotes ?? null,
        now
      ]
    );

    const updated = await this.findById(input.id);
    if (!updated) {
      throw new Error("Failed to update bug report.");
    }
    return updated;
  }

  async listHistory(reportId: number): Promise<BugReportHistoryEntry[]> {
    const [rows] = await this.pool.execute(
      "SELECT * FROM bug_report_history WHERE report_id = ? ORDER BY created_at DESC, id DESC",
      [reportId]
    );
    return (rows as BugReportHistoryRow[]).map(fromHistoryRow);
  }

  async summary(): Promise<BugReportSummary> {
    const [newRows] = await this.pool.execute("SELECT COUNT(*) AS value FROM bug_reports WHERE status = 'novo'");
    const [rows] = await this.pool.execute("SELECT status, COUNT(*) AS total FROM bug_reports GROUP BY status ORDER BY status ASC");
    return {
      newCount: Number((newRows as CountRow[])[0]?.value ?? 0),
      byStatus: (rows as StatusCountRow[]).map((row) => ({ status: row.status, total: Number(row.total) }))
    };
  }
}
