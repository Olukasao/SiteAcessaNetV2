import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";
import type {
  Notice,
  NoticeAudienceFilter,
  NoticeAudienceType,
  NoticeDisplay,
  NoticeFrequency,
  NoticeOrigin,
  NoticePriority,
  NoticeType
} from "../notices/types.js";

export interface CreateNoticeInput {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  type: NoticeType;
  display: NoticeDisplay;
  priority: NoticePriority;
  dismissible: boolean;
  frequency: NoticeFrequency;
  origin: NoticeOrigin;
  audienceType: NoticeAudienceType;
  audienceFilter: NoticeAudienceFilter | null;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  createdBy: string;
}

export type UpdateNoticeInput = Omit<CreateNoticeInput, "id" | "createdBy">;

export interface NoticeRepository {
  create(input: CreateNoticeInput): Promise<Notice>;
  findById(id: string, options?: { includeDeleted?: boolean }): Promise<Notice | null>;
  list(options?: { includeDeleted?: boolean }): Promise<Notice[]>;
  listActiveCandidates(now: Date): Promise<Notice[]>;
  /** CAS: so aplica se version bater; retorna false em conflito ou aviso inexistente/excluido. */
  update(id: string, expectedVersion: number, patch: UpdateNoticeInput): Promise<boolean>;
  setActive(id: string, expectedVersion: number, active: boolean): Promise<boolean>;
  softDelete(id: string, expectedVersion: number): Promise<boolean>;
}

interface NoticeRow {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  type: string;
  display: string;
  priority: string;
  dismissible: number;
  frequency: string;
  origin: string;
  audience_type: string;
  audience_filter: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: number;
  deleted_at: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function fromRow(row: NoticeRow): Notice {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    imageUrl: row.image_url,
    type: row.type as Notice["type"],
    display: row.display as NoticeDisplay,
    priority: row.priority as NoticePriority,
    dismissible: row.dismissible === 1,
    frequency: row.frequency as NoticeFrequency,
    origin: row.origin as NoticeOrigin,
    audienceType: row.audience_type as NoticeAudienceType,
    audienceFilter: row.audience_filter ? (JSON.parse(row.audience_filter) as NoticeAudienceFilter) : null,
    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    active: row.active === 1,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    version: row.version,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/** Ordem de exibicao quando ha mais de um aviso: critica primeiro, depois alta/normal/baixa. */
const PRIORITY_WEIGHT: Record<NoticePriority, number> = { critica: 3, alta: 2, normal: 1, baixa: 0 };

export class SqliteNoticeRepository implements NoticeRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(input: CreateNoticeInput): Promise<Notice> {
    this.db
      .prepare(
        `INSERT INTO central_notices
          (id, title, message, image_url, type, display, priority, dismissible, frequency, origin, audience_type, audience_filter, starts_at, ends_at, active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.title,
        input.message,
        input.imageUrl,
        input.type,
        input.display,
        input.priority,
        input.dismissible ? 1 : 0,
        input.frequency,
        input.origin,
        input.audienceType,
        input.audienceFilter ? JSON.stringify(input.audienceFilter) : null,
        input.startsAt ? input.startsAt.toISOString() : null,
        input.endsAt ? input.endsAt.toISOString() : null,
        input.active ? 1 : 0,
        input.createdBy
      );

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create central_notices row ${input.id}`);
    }
    return created;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<Notice | null> {
    const row = options.includeDeleted
      ? (this.db.prepare("SELECT * FROM central_notices WHERE id = ?").get(id) as unknown as NoticeRow | undefined)
      : (this.db
          .prepare("SELECT * FROM central_notices WHERE id = ? AND deleted_at IS NULL")
          .get(id) as unknown as NoticeRow | undefined);

    return row ? fromRow(row) : null;
  }

  async list(options: { includeDeleted?: boolean } = {}): Promise<Notice[]> {
    const rows = options.includeDeleted
      ? (this.db.prepare("SELECT * FROM central_notices ORDER BY created_at DESC").all() as unknown as NoticeRow[])
      : (this.db
          .prepare("SELECT * FROM central_notices WHERE deleted_at IS NULL ORDER BY created_at DESC")
          .all() as unknown as NoticeRow[]);

    return rows.map(fromRow);
  }

  async listActiveCandidates(now: Date): Promise<Notice[]> {
    const nowIso = now.toISOString();
    const rows = this.db
      .prepare(
        `SELECT * FROM central_notices
         WHERE active = 1 AND deleted_at IS NULL
           AND (starts_at IS NULL OR starts_at <= ?)
           AND (ends_at IS NULL OR ends_at >= ?)`
      )
      .all(nowIso, nowIso) as unknown as NoticeRow[];

    return rows.map(fromRow).sort((left, right) => PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority]);
  }

  async update(id: string, expectedVersion: number, patch: UpdateNoticeInput): Promise<boolean> {
    const result = this.db
      .prepare(
        `UPDATE central_notices SET
           title = ?, message = ?, image_url = ?, type = ?, display = ?, priority = ?, dismissible = ?,
           frequency = ?, origin = ?, audience_type = ?, audience_filter = ?,
           starts_at = ?, ends_at = ?, active = ?, version = version + 1, updated_at = datetime('now')
         WHERE id = ? AND version = ? AND deleted_at IS NULL`
      )
      .run(
        patch.title,
        patch.message,
        patch.imageUrl,
        patch.type,
        patch.display,
        patch.priority,
        patch.dismissible ? 1 : 0,
        patch.frequency,
        patch.origin,
        patch.audienceType,
        patch.audienceFilter ? JSON.stringify(patch.audienceFilter) : null,
        patch.startsAt ? patch.startsAt.toISOString() : null,
        patch.endsAt ? patch.endsAt.toISOString() : null,
        patch.active ? 1 : 0,
        id,
        expectedVersion
      );

    return Number(result.changes) > 0;
  }

  async setActive(id: string, expectedVersion: number, active: boolean): Promise<boolean> {
    const result = this.db
      .prepare(
        "UPDATE central_notices SET active = ?, version = version + 1, updated_at = datetime('now') WHERE id = ? AND version = ? AND deleted_at IS NULL"
      )
      .run(active ? 1 : 0, id, expectedVersion);

    return Number(result.changes) > 0;
  }

  async softDelete(id: string, expectedVersion: number): Promise<boolean> {
    const result = this.db
      .prepare(
        "UPDATE central_notices SET deleted_at = datetime('now'), active = 0, version = version + 1, updated_at = datetime('now') WHERE id = ? AND version = ? AND deleted_at IS NULL"
      )
      .run(id, expectedVersion);

    return Number(result.changes) > 0;
  }
}

export class MysqlNoticeRepository implements NoticeRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateNoticeInput): Promise<Notice> {
    await this.pool.execute(
      `INSERT INTO central_notices
        (id, title, message, image_url, type, display, priority, dismissible, frequency, origin, audience_type, audience_filter, starts_at, ends_at, active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.title,
        input.message,
        input.imageUrl,
        input.type,
        input.display,
        input.priority,
        input.dismissible ? 1 : 0,
        input.frequency,
        input.origin,
        input.audienceType,
        input.audienceFilter ? JSON.stringify(input.audienceFilter) : null,
        input.startsAt ? input.startsAt.toISOString() : null,
        input.endsAt ? input.endsAt.toISOString() : null,
        input.active ? 1 : 0,
        input.createdBy
      ]
    );

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create central_notices row ${input.id}`);
    }
    return created;
  }

  async findById(id: string, options: { includeDeleted?: boolean } = {}): Promise<Notice | null> {
    const [rows] = options.includeDeleted
      ? await this.pool.execute("SELECT * FROM central_notices WHERE id = ?", [id])
      : await this.pool.execute("SELECT * FROM central_notices WHERE id = ? AND deleted_at IS NULL", [id]);

    const row = (rows as NoticeRow[])[0];
    return row ? fromRow(row) : null;
  }

  async list(options: { includeDeleted?: boolean } = {}): Promise<Notice[]> {
    const [rows] = options.includeDeleted
      ? await this.pool.execute("SELECT * FROM central_notices ORDER BY created_at DESC")
      : await this.pool.execute("SELECT * FROM central_notices WHERE deleted_at IS NULL ORDER BY created_at DESC");

    return (rows as NoticeRow[]).map(fromRow);
  }

  async listActiveCandidates(now: Date): Promise<Notice[]> {
    const nowIso = now.toISOString();
    const [rows] = await this.pool.execute(
      `SELECT * FROM central_notices
       WHERE active = 1 AND deleted_at IS NULL
         AND (starts_at IS NULL OR starts_at <= ?)
         AND (ends_at IS NULL OR ends_at >= ?)`,
      [nowIso, nowIso]
    );

    return (rows as NoticeRow[])
      .map(fromRow)
      .sort((left, right) => PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority]);
  }

  async update(id: string, expectedVersion: number, patch: UpdateNoticeInput): Promise<boolean> {
    const [result] = await this.pool.execute(
      `UPDATE central_notices SET
         title = ?, message = ?, image_url = ?, type = ?, display = ?, priority = ?, dismissible = ?,
         frequency = ?, origin = ?, audience_type = ?, audience_filter = ?,
         starts_at = ?, ends_at = ?, active = ?, version = version + 1, updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND version = ? AND deleted_at IS NULL`,
      [
        patch.title,
        patch.message,
        patch.imageUrl,
        patch.type,
        patch.display,
        patch.priority,
        patch.dismissible ? 1 : 0,
        patch.frequency,
        patch.origin,
        patch.audienceType,
        patch.audienceFilter ? JSON.stringify(patch.audienceFilter) : null,
        patch.startsAt ? patch.startsAt.toISOString() : null,
        patch.endsAt ? patch.endsAt.toISOString() : null,
        patch.active ? 1 : 0,
        id,
        expectedVersion
      ]
    );

    return Number((result as { affectedRows: number }).affectedRows) > 0;
  }

  async setActive(id: string, expectedVersion: number, active: boolean): Promise<boolean> {
    const [result] = await this.pool.execute(
      "UPDATE central_notices SET active = ?, version = version + 1, updated_at = UTC_TIMESTAMP() WHERE id = ? AND version = ? AND deleted_at IS NULL",
      [active ? 1 : 0, id, expectedVersion]
    );

    return Number((result as { affectedRows: number }).affectedRows) > 0;
  }

  async softDelete(id: string, expectedVersion: number): Promise<boolean> {
    const [result] = await this.pool.execute(
      "UPDATE central_notices SET deleted_at = UTC_TIMESTAMP(), active = 0, version = version + 1, updated_at = UTC_TIMESTAMP() WHERE id = ? AND version = ? AND deleted_at IS NULL",
      [id, expectedVersion]
    );

    return Number((result as { affectedRows: number }).affectedRows) > 0;
  }
}
