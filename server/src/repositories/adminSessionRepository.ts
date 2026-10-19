import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export interface AdminSessionRecord {
  id: string;
  sessionTokenHash: string;
  adminUserId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  revokedAt: Date | null;
  ipHash: string | null;
  userAgent: string | null;
}

export interface CreateAdminSessionInput {
  id: string;
  sessionTokenHash: string;
  adminUserId: string;
  expiresAt: Date;
  ipHash?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface AdminSessionRepository {
  create(input: CreateAdminSessionInput): Promise<AdminSessionRecord>;
  findById(id: string): Promise<AdminSessionRecord | null>;
  touchActivity(id: string, when: Date): Promise<void>;
  updateTokenHash(id: string, sessionTokenHash: string): Promise<void>;
  revoke(id: string, when: Date): Promise<void>;
}

interface AdminSessionRow {
  id: string;
  session_token_hash: string;
  admin_user_id: string;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  revoked_at: string | null;
  ip_hash: string | null;
  user_agent: string | null;
}

function fromRow(row: AdminSessionRow): AdminSessionRecord {
  return {
    id: row.id,
    sessionTokenHash: row.session_token_hash,
    adminUserId: row.admin_user_id,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    lastActivityAt: new Date(row.last_activity_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    ipHash: row.ip_hash,
    userAgent: row.user_agent
  };
}

export class SqliteAdminSessionRepository implements AdminSessionRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(input: CreateAdminSessionInput): Promise<AdminSessionRecord> {
    this.db
      .prepare(
        "INSERT INTO admin_sessions (id, session_token_hash, admin_user_id, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        input.id,
        input.sessionTokenHash,
        input.adminUserId,
        input.expiresAt.toISOString(),
        input.ipHash ?? null,
        input.userAgent ?? null
      );

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create admin_sessions row ${input.id}`);
    }
    return created;
  }

  async findById(id: string): Promise<AdminSessionRecord | null> {
    const row = this.db.prepare("SELECT * FROM admin_sessions WHERE id = ?").get(id) as AdminSessionRow | undefined;
    return row ? fromRow(row) : null;
  }

  async touchActivity(id: string, when: Date): Promise<void> {
    this.db.prepare("UPDATE admin_sessions SET last_activity_at = ? WHERE id = ?").run(when.toISOString(), id);
  }

  async updateTokenHash(id: string, sessionTokenHash: string): Promise<void> {
    this.db.prepare("UPDATE admin_sessions SET session_token_hash = ? WHERE id = ?").run(sessionTokenHash, id);
  }

  async revoke(id: string, when: Date): Promise<void> {
    this.db
      .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
      .run(when.toISOString(), id);
  }
}

export class MysqlAdminSessionRepository implements AdminSessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateAdminSessionInput): Promise<AdminSessionRecord> {
    await this.pool.execute(
      "INSERT INTO admin_sessions (id, session_token_hash, admin_user_id, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
      [
        input.id,
        input.sessionTokenHash,
        input.adminUserId,
        input.expiresAt.toISOString(),
        input.ipHash ?? null,
        input.userAgent ?? null
      ]
    );

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create admin_sessions row ${input.id}`);
    }
    return created;
  }

  async findById(id: string): Promise<AdminSessionRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM admin_sessions WHERE id = ?", [id]);
    const row = (rows as AdminSessionRow[])[0];
    return row ? fromRow(row) : null;
  }

  async touchActivity(id: string, when: Date): Promise<void> {
    await this.pool.execute("UPDATE admin_sessions SET last_activity_at = ? WHERE id = ?", [when.toISOString(), id]);
  }

  async updateTokenHash(id: string, sessionTokenHash: string): Promise<void> {
    await this.pool.execute("UPDATE admin_sessions SET session_token_hash = ? WHERE id = ?", [sessionTokenHash, id]);
  }

  async revoke(id: string, when: Date): Promise<void> {
    await this.pool.execute("UPDATE admin_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", [
      when.toISOString(),
      id
    ]);
  }
}
