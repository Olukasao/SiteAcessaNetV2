import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export type AdminAuditAction =
  | "AVISO_CRIADO"
  | "AVISO_EDITADO"
  | "AVISO_ATIVADO"
  | "AVISO_DESATIVADO"
  | "AVISO_EXCLUIDO"
  | "AVISO_PUBLICADO"
  | "ADMIN_LOGIN"
  | "ADMIN_LOGOUT"
  | "VIEW_ANALYTICS"
  | "VIEW_CLIENT"
  | "VIEW_ACTIVITY"
  | "VIEW_BUG_REPORTS"
  | "VIEW_BUG_REPORT"
  | "UPDATE_BUG_REPORT"
  | "VIEW_CHAMADOS"
  | "VIEW_CHAMADO"
  | "EXPORT_CHAMADOS";

export interface AdminAuditLogInput {
  adminUserId?: string | null | undefined;
  adminEmail?: string | null | undefined;
  action: AdminAuditAction;
  noticeId?: string | null | undefined;
  ipHash?: string | null | undefined;
  userAgent?: string | null | undefined;
  /** So os campos relevantes que mudaram -- nunca o registro inteiro, nunca segredo. */
  beforeSnapshot?: Record<string, unknown> | null | undefined;
  afterSnapshot?: Record<string, unknown> | null | undefined;
}

export interface AdminAuditLogEntry extends AdminAuditLogInput {
  id: number;
  createdAt: Date;
}

export interface AdminAuditLogRepository {
  record(input: AdminAuditLogInput): Promise<void>;
  listByNotice(noticeId: string): Promise<AdminAuditLogEntry[]>;
}

const USER_AGENT_MAX_LENGTH = 255;

interface AdminAuditLogRow {
  id: number;
  admin_user_id: string | null;
  admin_email: string | null;
  action: string;
  notice_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  before_snapshot: string | null;
  after_snapshot: string | null;
  created_at: string;
}

function fromRow(row: AdminAuditLogRow): AdminAuditLogEntry {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    adminEmail: row.admin_email,
    action: row.action as AdminAuditAction,
    noticeId: row.notice_id,
    ipHash: row.ip_hash,
    userAgent: row.user_agent,
    beforeSnapshot: row.before_snapshot ? (JSON.parse(row.before_snapshot) as Record<string, unknown>) : null,
    afterSnapshot: row.after_snapshot ? (JSON.parse(row.after_snapshot) as Record<string, unknown>) : null,
    createdAt: new Date(row.created_at)
  };
}

export class SqliteAdminAuditLogRepository implements AdminAuditLogRepository {
  constructor(private readonly db: DatabaseSync) {}

  async record(input: AdminAuditLogInput): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO admin_audit_logs
          (admin_user_id, admin_email, action, notice_id, ip_hash, user_agent, before_snapshot, after_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.adminUserId ?? null,
        input.adminEmail ?? null,
        input.action,
        input.noticeId ?? null,
        input.ipHash ?? null,
        input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
        input.beforeSnapshot ? JSON.stringify(input.beforeSnapshot) : null,
        input.afterSnapshot ? JSON.stringify(input.afterSnapshot) : null
      );
  }

  async listByNotice(noticeId: string): Promise<AdminAuditLogEntry[]> {
    const rows = this.db
      .prepare("SELECT * FROM admin_audit_logs WHERE notice_id = ? ORDER BY created_at DESC")
      .all(noticeId) as unknown as AdminAuditLogRow[];

    return rows.map(fromRow);
  }

}

export class MysqlAdminAuditLogRepository implements AdminAuditLogRepository {
  constructor(private readonly pool: Pool) {}

  async record(input: AdminAuditLogInput): Promise<void> {
    await this.pool.execute(
      `INSERT INTO admin_audit_logs
        (admin_user_id, admin_email, action, notice_id, ip_hash, user_agent, before_snapshot, after_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.adminUserId ?? null,
        input.adminEmail ?? null,
        input.action,
        input.noticeId ?? null,
        input.ipHash ?? null,
        input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
        input.beforeSnapshot ? JSON.stringify(input.beforeSnapshot) : null,
        input.afterSnapshot ? JSON.stringify(input.afterSnapshot) : null
      ]
    );
  }

  async listByNotice(noticeId: string): Promise<AdminAuditLogEntry[]> {
    const [rows] = await this.pool.execute(
      "SELECT * FROM admin_audit_logs WHERE notice_id = ? ORDER BY created_at DESC",
      [noticeId]
    );
    return (rows as AdminAuditLogRow[]).map(fromRow);
  }

}
