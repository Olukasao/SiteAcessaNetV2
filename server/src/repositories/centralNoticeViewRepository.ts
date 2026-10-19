import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export interface NoticeViewStats {
  totalViews: number;
  uniqueCustomers: number;
  firstViewedAt: Date | null;
  lastViewedAt: Date | null;
}

export interface NoticeViewRepository {
  /** Upsert: primeira vez cria a linha (view_count=1), proximas incrementam e atualizam viewed_version/last_viewed_at. */
  upsertView(noticeId: string, customerId: string, version: number, now?: Date): Promise<void>;
  /** true se este cliente ja viu esta versao (ou uma mais nova) do aviso -- usado por "once_per_customer". */
  hasSeenVersion(noticeId: string, customerId: string, version: number): Promise<boolean>;
  getStats(noticeId: string): Promise<NoticeViewStats>;
}

interface ViewRow {
  view_count: number;
  viewed_version: number;
}

interface StatsRow {
  total_views: number;
  unique_customers: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
}

export class SqliteNoticeViewRepository implements NoticeViewRepository {
  constructor(private readonly db: DatabaseSync) {}

  async upsertView(noticeId: string, customerId: string, version: number, now = new Date()): Promise<void> {
    const nowIso = now.toISOString();
    this.db
      .prepare(
        `INSERT INTO central_notice_views (notice_id, customer_id, viewed_version, first_viewed_at, last_viewed_at, view_count)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(notice_id, customer_id) DO UPDATE SET
           viewed_version = excluded.viewed_version,
           last_viewed_at = excluded.last_viewed_at,
           view_count = view_count + 1`
      )
      .run(noticeId, customerId, version, nowIso, nowIso);
  }

  async hasSeenVersion(noticeId: string, customerId: string, version: number): Promise<boolean> {
    const row = this.db
      .prepare("SELECT view_count, viewed_version FROM central_notice_views WHERE notice_id = ? AND customer_id = ?")
      .get(noticeId, customerId) as unknown as ViewRow | undefined;

    return Boolean(row && row.viewed_version >= version);
  }

  async getStats(noticeId: string): Promise<NoticeViewStats> {
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(view_count), 0) AS total_views,
           COUNT(*) AS unique_customers,
           MIN(first_viewed_at) AS first_viewed_at,
           MAX(last_viewed_at) AS last_viewed_at
         FROM central_notice_views WHERE notice_id = ?`
      )
      .get(noticeId) as unknown as StatsRow;

    return {
      totalViews: Number(row.total_views ?? 0),
      uniqueCustomers: Number(row.unique_customers ?? 0),
      firstViewedAt: row.first_viewed_at ? new Date(row.first_viewed_at) : null,
      lastViewedAt: row.last_viewed_at ? new Date(row.last_viewed_at) : null
    };
  }
}

export class MysqlNoticeViewRepository implements NoticeViewRepository {
  constructor(private readonly pool: Pool) {}

  async upsertView(noticeId: string, customerId: string, version: number, now = new Date()): Promise<void> {
    const nowIso = now.toISOString();
    await this.pool.execute(
      `INSERT INTO central_notice_views (notice_id, customer_id, viewed_version, first_viewed_at, last_viewed_at, view_count)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         viewed_version = VALUES(viewed_version),
         last_viewed_at = VALUES(last_viewed_at),
         view_count = view_count + 1`,
      [noticeId, customerId, version, nowIso, nowIso]
    );
  }

  async hasSeenVersion(noticeId: string, customerId: string, version: number): Promise<boolean> {
    const [rows] = await this.pool.execute(
      "SELECT view_count, viewed_version FROM central_notice_views WHERE notice_id = ? AND customer_id = ?",
      [noticeId, customerId]
    );
    const row = (rows as ViewRow[])[0];
    return Boolean(row && row.viewed_version >= version);
  }

  async getStats(noticeId: string): Promise<NoticeViewStats> {
    const [rows] = await this.pool.execute(
      `SELECT
         COALESCE(SUM(view_count), 0) AS total_views,
         COUNT(*) AS unique_customers,
         MIN(first_viewed_at) AS first_viewed_at,
         MAX(last_viewed_at) AS last_viewed_at
       FROM central_notice_views WHERE notice_id = ?`,
      [noticeId]
    );
    const row = (rows as StatsRow[])[0]!;

    return {
      totalViews: Number(row.total_views ?? 0),
      uniqueCustomers: Number(row.unique_customers ?? 0),
      firstViewedAt: row.first_viewed_at ? new Date(row.first_viewed_at) : null,
      lastViewedAt: row.last_viewed_at ? new Date(row.last_viewed_at) : null
    };
  }
}
