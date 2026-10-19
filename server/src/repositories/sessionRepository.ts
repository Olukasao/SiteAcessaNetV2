import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export interface AuthSessionRecord {
  id: string;
  sessionTokenHash: string;
  customerId: string;
  cpfHash: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  revokedAt: Date | null;
  ipHash: string | null;
  userAgent: string | null;
}

export interface CreateAuthSessionInput {
  id: string;
  sessionTokenHash: string;
  customerId: string;
  cpfHash: string;
  expiresAt: Date;
  ipHash?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface SessionRepository {
  create(input: CreateAuthSessionInput): Promise<AuthSessionRecord>;
  findById(id: string): Promise<AuthSessionRecord | null>;
  touchActivity(id: string, when: Date): Promise<void>;
  /** Roda a cada refresh (rotacao de refresh token): troca o hash guardado sem mexer em revoked_at. */
  updateTokenHash(id: string, sessionTokenHash: string): Promise<void>;
  revoke(id: string, when: Date): Promise<void>;
  revokeAllForCpfHash(cpfHash: string, when: Date, exceptId?: string): Promise<number>;
}

interface AuthSessionRow {
  id: string;
  session_token_hash: string;
  customer_id: string;
  cpf_hash: string;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  revoked_at: string | null;
  ip_hash: string | null;
  user_agent: string | null;
}

function fromRow(row: AuthSessionRow): AuthSessionRecord {
  return {
    id: row.id,
    sessionTokenHash: row.session_token_hash,
    customerId: row.customer_id,
    cpfHash: row.cpf_hash,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    lastActivityAt: new Date(row.last_activity_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    ipHash: row.ip_hash,
    userAgent: row.user_agent
  };
}

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    this.db
      .prepare(
        "INSERT INTO auth_sessions (id, session_token_hash, customer_id, cpf_hash, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        input.id,
        input.sessionTokenHash,
        input.customerId,
        input.cpfHash,
        input.expiresAt.toISOString(),
        input.ipHash ?? null,
        input.userAgent ?? null
      );

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create auth_sessions row ${input.id}`);
    }
    return created;
  }

  async findById(id: string): Promise<AuthSessionRecord | null> {
    const row = this.db.prepare("SELECT * FROM auth_sessions WHERE id = ?").get(id) as AuthSessionRow | undefined;
    return row ? fromRow(row) : null;
  }

  async touchActivity(id: string, when: Date): Promise<void> {
    this.db.prepare("UPDATE auth_sessions SET last_activity_at = ? WHERE id = ?").run(when.toISOString(), id);
  }

  async updateTokenHash(id: string, sessionTokenHash: string): Promise<void> {
    this.db.prepare("UPDATE auth_sessions SET session_token_hash = ? WHERE id = ?").run(sessionTokenHash, id);
  }

  async revoke(id: string, when: Date): Promise<void> {
    this.db
      .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
      .run(when.toISOString(), id);
  }

  async revokeAllForCpfHash(cpfHash: string, when: Date, exceptId?: string): Promise<number> {
    const result = exceptId
      ? this.db
          .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE cpf_hash = ? AND revoked_at IS NULL AND id != ?")
          .run(when.toISOString(), cpfHash, exceptId)
      : this.db
          .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE cpf_hash = ? AND revoked_at IS NULL")
          .run(when.toISOString(), cpfHash);

    return Number(result.changes);
  }
}

export class MysqlSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    await this.pool.execute(
      "INSERT INTO auth_sessions (id, session_token_hash, customer_id, cpf_hash, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        input.id,
        input.sessionTokenHash,
        input.customerId,
        input.cpfHash,
        input.expiresAt.toISOString(),
        input.ipHash ?? null,
        input.userAgent ?? null
      ]
    );

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create auth_sessions row ${input.id}`);
    }
    return created;
  }

  async findById(id: string): Promise<AuthSessionRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM auth_sessions WHERE id = ?", [id]);
    const row = (rows as AuthSessionRow[])[0];
    return row ? fromRow(row) : null;
  }

  async touchActivity(id: string, when: Date): Promise<void> {
    await this.pool.execute("UPDATE auth_sessions SET last_activity_at = ? WHERE id = ?", [when.toISOString(), id]);
  }

  async updateTokenHash(id: string, sessionTokenHash: string): Promise<void> {
    await this.pool.execute("UPDATE auth_sessions SET session_token_hash = ? WHERE id = ?", [sessionTokenHash, id]);
  }

  async revoke(id: string, when: Date): Promise<void> {
    await this.pool.execute("UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", [
      when.toISOString(),
      id
    ]);
  }

  async revokeAllForCpfHash(cpfHash: string, when: Date, exceptId?: string): Promise<number> {
    const [result] = exceptId
      ? await this.pool.execute(
          "UPDATE auth_sessions SET revoked_at = ? WHERE cpf_hash = ? AND revoked_at IS NULL AND id != ?",
          [when.toISOString(), cpfHash, exceptId]
        )
      : await this.pool.execute("UPDATE auth_sessions SET revoked_at = ? WHERE cpf_hash = ? AND revoked_at IS NULL", [
          when.toISOString(),
          cpfHash
        ]);

    return Number((result as { affectedRows: number }).affectedRows);
  }
}
