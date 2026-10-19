import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

/**
 * Curriculos enviados pela pagina "Trabalhe conosco". O arquivo fica no
 * proprio banco (BLOB) e nao em disco: a Hostinger pode apagar a pasta da
 * app a cada deploy (ver deploy-hostinger.sh), e o banco e o unico lugar que
 * sobrevive. Limite de 5 MB por arquivo e validado na rota.
 */
export const JOB_APPLICATION_STATUSES = ["novo", "em_analise", "contatado", "arquivado"] as const;
export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

export const JOB_APPLICATION_AREAS = ["Suporte Técnico", "Instalador", "Atendimento", "Administrativo", "Outra"] as const;

export interface JobApplicationRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  area: string | null;
  message: string | null;
  fileName: string;
  fileMime: string;
  fileSize: number;
  status: JobApplicationStatus;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobApplicationFile {
  fileName: string;
  fileMime: string;
  data: Buffer;
}

export interface CreateJobApplicationInput {
  name: string;
  email: string;
  phone: string;
  area?: string | null | undefined;
  message?: string | null | undefined;
  fileName: string;
  fileMime: string;
  fileData: Buffer;
  ipHash?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface JobApplicationFilters {
  page: number;
  limit: number;
  status?: string | undefined;
  area?: string | undefined;
  search?: string | undefined;
}

export interface JobApplicationListResult {
  items: JobApplicationRecord[];
  page: number;
  limit: number;
  total: number;
}

export interface UpdateJobApplicationInput {
  id: number;
  status?: JobApplicationStatus | undefined;
  adminNotes?: string | null | undefined;
}

export interface JobApplicationRepository {
  create(input: CreateJobApplicationInput): Promise<JobApplicationRecord>;
  findById(id: number): Promise<JobApplicationRecord | null>;
  getFile(id: number): Promise<JobApplicationFile | null>;
  list(filters: JobApplicationFilters): Promise<JobApplicationListResult>;
  update(input: UpdateJobApplicationInput): Promise<JobApplicationRecord | null>;
  countNew(): Promise<number>;
}

type SqlParam = string | number | null;

/** Nunca seleciona file_data na listagem -- so no download. */
const RECORD_COLUMNS =
  "id, name, email, phone, area, message, file_name, file_mime, file_size, status, admin_notes, created_at, updated_at";

interface JobApplicationRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  area: string | null;
  message: string | null;
  file_name: string;
  file_mime: string;
  file_size: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FileRow {
  file_name: string;
  file_mime: string;
  file_data: Uint8Array | Buffer;
}

interface CountRow {
  value: number;
}

function iso(value: Date) {
  return value.toISOString();
}

function fromRow(row: JobApplicationRow): JobApplicationRecord {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    area: row.area,
    message: row.message,
    fileName: row.file_name,
    fileMime: row.file_mime,
    fileSize: Number(row.file_size),
    status: row.status as JobApplicationStatus,
    adminNotes: row.admin_notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function fromFileRow(row: FileRow): JobApplicationFile {
  return { fileName: row.file_name, fileMime: row.file_mime, data: Buffer.from(row.file_data) };
}

function buildWhere(filters: JobApplicationFilters) {
  const clauses: string[] = [];
  const params: SqlParam[] = [];

  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters.area) {
    clauses.push("area = ?");
    params.push(filters.area);
  }
  if (filters.search) {
    clauses.push("(name LIKE ? OR email LIKE ? OR phone LIKE ? OR message LIKE ?)");
    const value = `%${filters.search}%`;
    params.push(value, value, value, value);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const INSERT_SQL = `INSERT INTO job_applications
  (name, email, phone, area, message, file_name, file_mime, file_size, file_data, status, ip_hash, user_agent, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function insertValues(input: CreateJobApplicationInput) {
  const now = iso(new Date());
  return [
    input.name.slice(0, 200),
    input.email.slice(0, 255),
    input.phone.slice(0, 40),
    input.area ? input.area.slice(0, 100) : null,
    input.message ? input.message.slice(0, 3000) : null,
    input.fileName.slice(0, 255),
    input.fileMime.slice(0, 120),
    input.fileData.length,
    input.fileData,
    "novo",
    input.ipHash ?? null,
    input.userAgent ? input.userAgent.slice(0, 500) : null,
    now,
    now
  ] as const;
}

export class SqliteJobApplicationRepository implements JobApplicationRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(input: CreateJobApplicationInput): Promise<JobApplicationRecord> {
    const result = this.db.prepare(INSERT_SQL).run(...insertValues(input));
    const created = await this.findById(Number(result.lastInsertRowid));
    if (!created) throw new Error("Failed to create job application.");
    return created;
  }

  async findById(id: number): Promise<JobApplicationRecord | null> {
    const row = this.db.prepare(`SELECT ${RECORD_COLUMNS} FROM job_applications WHERE id = ?`).get(id) as
      | JobApplicationRow
      | undefined;
    return row ? fromRow(row) : null;
  }

  async getFile(id: number): Promise<JobApplicationFile | null> {
    const row = this.db.prepare("SELECT file_name, file_mime, file_data FROM job_applications WHERE id = ?").get(id) as
      | FileRow
      | undefined;
    return row ? fromFileRow(row) : null;
  }

  async list(filters: JobApplicationFilters): Promise<JobApplicationListResult> {
    const { where, params } = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;
    const totalRow = this.db.prepare(`SELECT COUNT(*) AS value FROM job_applications ${where}`).get(...params) as
      | CountRow
      | undefined;
    const rows = this.db
      .prepare(`SELECT ${RECORD_COLUMNS} FROM job_applications ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, filters.limit, offset) as unknown as JobApplicationRow[];
    return { items: rows.map(fromRow), page: filters.page, limit: filters.limit, total: Number(totalRow?.value ?? 0) };
  }

  async update(input: UpdateJobApplicationInput): Promise<JobApplicationRecord | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const status = input.status ?? existing.status;
    const notes = input.adminNotes === undefined ? existing.adminNotes : input.adminNotes;
    this.db
      .prepare("UPDATE job_applications SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?")
      .run(status, notes ?? null, iso(new Date()), input.id);
    return this.findById(input.id);
  }

  async countNew(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) AS value FROM job_applications WHERE status = 'novo'").get() as
      | CountRow
      | undefined;
    return Number(row?.value ?? 0);
  }
}

export class MysqlJobApplicationRepository implements JobApplicationRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateJobApplicationInput): Promise<JobApplicationRecord> {
    const [result] = await this.pool.execute(INSERT_SQL, [...insertValues(input)]);
    const created = await this.findById(Number((result as { insertId?: number }).insertId));
    if (!created) throw new Error("Failed to create job application.");
    return created;
  }

  async findById(id: number): Promise<JobApplicationRecord | null> {
    const [rows] = await this.pool.execute(`SELECT ${RECORD_COLUMNS} FROM job_applications WHERE id = ?`, [id]);
    const row = (rows as JobApplicationRow[])[0];
    return row ? fromRow(row) : null;
  }

  async getFile(id: number): Promise<JobApplicationFile | null> {
    const [rows] = await this.pool.execute("SELECT file_name, file_mime, file_data FROM job_applications WHERE id = ?", [id]);
    const row = (rows as FileRow[])[0];
    return row ? fromFileRow(row) : null;
  }

  async list(filters: JobApplicationFilters): Promise<JobApplicationListResult> {
    const { where, params } = buildWhere(filters);
    const offset = (filters.page - 1) * filters.limit;
    const [countRows] = await this.pool.execute(`SELECT COUNT(*) AS value FROM job_applications ${where}`, params);
    const [rows] = await this.pool.execute(
      `SELECT ${RECORD_COLUMNS} FROM job_applications ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, filters.limit, offset]
    );
    return {
      items: (rows as JobApplicationRow[]).map(fromRow),
      page: filters.page,
      limit: filters.limit,
      total: Number((countRows as CountRow[])[0]?.value ?? 0)
    };
  }

  async update(input: UpdateJobApplicationInput): Promise<JobApplicationRecord | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const status = input.status ?? existing.status;
    const notes = input.adminNotes === undefined ? existing.adminNotes : input.adminNotes;
    await this.pool.execute("UPDATE job_applications SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?", [
      status,
      notes ?? null,
      iso(new Date()),
      input.id
    ]);
    return this.findById(input.id);
  }

  async countNew(): Promise<number> {
    const [rows] = await this.pool.execute("SELECT COUNT(*) AS value FROM job_applications WHERE status = 'novo'");
    return Number((rows as CountRow[])[0]?.value ?? 0);
  }
}
