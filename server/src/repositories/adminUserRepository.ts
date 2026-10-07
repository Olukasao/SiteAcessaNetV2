import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";
import type { AdminRole } from "../auth/adminPermissions.js";

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: AdminRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminUserInput {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: AdminRole;
}

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUserRecord | null>;
  findById(id: string): Promise<AdminUserRecord | null>;
  create(input: CreateAdminUserInput): Promise<AdminUserRecord>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  active: number;
  created_at: string;
  updated_at: string;
}

function fromRow(row: AdminUserRow): AdminUserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role as AdminRole,
    active: row.active === 1,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class SqliteAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: DatabaseSync) {}

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM admin_users WHERE email = ?")
      .get(email.toLowerCase().trim()) as AdminUserRow | undefined;
    return row ? fromRow(row) : null;
  }

  async findById(id: string): Promise<AdminUserRecord | null> {
    const row = this.db.prepare("SELECT * FROM admin_users WHERE id = ?").get(id) as AdminUserRow | undefined;
    return row ? fromRow(row) : null;
  }

  async create(input: CreateAdminUserInput): Promise<AdminUserRecord> {
    this.db
      .prepare("INSERT INTO admin_users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
      .run(input.id, input.email.toLowerCase().trim(), input.name, input.passwordHash, input.role);

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create admin_users row ${input.id}`);
    }
    return created;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    this.db
      .prepare("UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .run(passwordHash, id);
  }
}

export class MysqlAdminUserRepository implements AdminUserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM admin_users WHERE email = ?", [email.toLowerCase().trim()]);
    const row = (rows as AdminUserRow[])[0];
    return row ? fromRow(row) : null;
  }

  async findById(id: string): Promise<AdminUserRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM admin_users WHERE id = ?", [id]);
    const row = (rows as AdminUserRow[])[0];
    return row ? fromRow(row) : null;
  }

  async create(input: CreateAdminUserInput): Promise<AdminUserRecord> {
    await this.pool.execute("INSERT INTO admin_users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)", [
      input.id,
      input.email.toLowerCase().trim(),
      input.name,
      input.passwordHash,
      input.role
    ]);

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create admin_users row ${input.id}`);
    }
    return created;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.pool.execute("UPDATE admin_users SET password_hash = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?", [
      passwordHash,
      id
    ]);
  }
}
