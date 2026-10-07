import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export interface AuthProfileRecord {
  cpfHash: string;
  sgpCustomerId: string | null;
  cpfLastDigits: string | null;
  firstAccessCompleted: boolean;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  lastLoginIpHash: string | null;
  /** Hash scrypt da senha propria do app (ver security/hash.ts). NULL ate o cliente criar a senha no primeiro acesso. */
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthProfileRepository {
  findByCpfHash(cpfHash: string): Promise<AuthProfileRecord | null>;
  getOrCreate(input: { cpfHash: string; cpfLastDigits: string; sgpCustomerId?: string | null | undefined }): Promise<AuthProfileRecord>;
  markFirstAccessCompleted(cpfHash: string, when: Date): Promise<void>;
  markPasswordChanged(cpfHash: string, when: Date): Promise<void>;
  recordSuccessfulLogin(cpfHash: string, ipHash: string | undefined, when: Date): Promise<void>;
  setPasswordHash(cpfHash: string, passwordHash: string, when: Date): Promise<void>;
}

interface AuthProfileRow {
  cpf_hash: string;
  sgp_customer_id: string | null;
  cpf_last_digits: string | null;
  first_access_completed: number;
  password_changed_at: string | null;
  last_login_at: string | null;
  last_login_ip_hash: string | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: AuthProfileRow): AuthProfileRecord {
  return {
    cpfHash: row.cpf_hash,
    sgpCustomerId: row.sgp_customer_id,
    cpfLastDigits: row.cpf_last_digits,
    firstAccessCompleted: Boolean(row.first_access_completed),
    passwordChangedAt: row.password_changed_at ? new Date(row.password_changed_at) : null,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    lastLoginIpHash: row.last_login_ip_hash,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class SqliteAuthProfileRepository implements AuthProfileRepository {
  constructor(private readonly db: DatabaseSync) {}

  async findByCpfHash(cpfHash: string): Promise<AuthProfileRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM customer_auth_profiles WHERE cpf_hash = ?")
      .get(cpfHash) as AuthProfileRow | undefined;
    return row ? fromRow(row) : null;
  }

  async getOrCreate(input: { cpfHash: string; cpfLastDigits: string; sgpCustomerId?: string | null | undefined }): Promise<AuthProfileRecord> {
    const existing = await this.findByCpfHash(input.cpfHash);
    if (existing) {
      if (input.sgpCustomerId && existing.sgpCustomerId !== input.sgpCustomerId) {
        this.db
          .prepare("UPDATE customer_auth_profiles SET sgp_customer_id = ?, updated_at = datetime('now') WHERE cpf_hash = ?")
          .run(input.sgpCustomerId, input.cpfHash);
        return { ...existing, sgpCustomerId: input.sgpCustomerId };
      }
      return existing;
    }

    // Corrida entre requisicoes concorrentes no primeiro acesso: cpf_hash e
    // PRIMARY KEY, entao um insert duplicado falha e buscamos o ja existente.
    try {
      this.db
        .prepare(
          "INSERT INTO customer_auth_profiles (cpf_hash, cpf_last_digits, sgp_customer_id) VALUES (?, ?, ?)"
        )
        .run(input.cpfHash, input.cpfLastDigits, input.sgpCustomerId ?? null);
    } catch {
      // ignora conflito de PK, busca abaixo
    }

    const created = await this.findByCpfHash(input.cpfHash);
    if (!created) {
      throw new Error(`Failed to create customer_auth_profiles row for cpf_hash ${input.cpfHash.slice(0, 8)}...`);
    }
    return created;
  }

  async markFirstAccessCompleted(cpfHash: string, when: Date): Promise<void> {
    this.db
      .prepare(
        "UPDATE customer_auth_profiles SET first_access_completed = 1, password_changed_at = ?, updated_at = datetime('now') WHERE cpf_hash = ?"
      )
      .run(when.toISOString(), cpfHash);
  }

  async markPasswordChanged(cpfHash: string, when: Date): Promise<void> {
    this.db
      .prepare("UPDATE customer_auth_profiles SET password_changed_at = ?, updated_at = datetime('now') WHERE cpf_hash = ?")
      .run(when.toISOString(), cpfHash);
  }

  async recordSuccessfulLogin(cpfHash: string, ipHash: string | undefined, when: Date): Promise<void> {
    this.db
      .prepare(
        "UPDATE customer_auth_profiles SET last_login_at = ?, last_login_ip_hash = ?, updated_at = datetime('now') WHERE cpf_hash = ?"
      )
      .run(when.toISOString(), ipHash ?? null, cpfHash);
  }

  async setPasswordHash(cpfHash: string, passwordHash: string, when: Date): Promise<void> {
    this.db
      .prepare(
        "UPDATE customer_auth_profiles SET password_hash = ?, password_changed_at = ?, updated_at = datetime('now') WHERE cpf_hash = ?"
      )
      .run(passwordHash, when.toISOString(), cpfHash);
  }
}

export class MysqlAuthProfileRepository implements AuthProfileRepository {
  constructor(private readonly pool: Pool) {}

  async findByCpfHash(cpfHash: string): Promise<AuthProfileRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM customer_auth_profiles WHERE cpf_hash = ?", [cpfHash]);
    const row = (rows as AuthProfileRow[])[0];
    return row ? fromRow(row) : null;
  }

  async getOrCreate(input: { cpfHash: string; cpfLastDigits: string; sgpCustomerId?: string | null | undefined }): Promise<AuthProfileRecord> {
    const existing = await this.findByCpfHash(input.cpfHash);
    if (existing) {
      if (input.sgpCustomerId && existing.sgpCustomerId !== input.sgpCustomerId) {
        await this.pool.execute(
          "UPDATE customer_auth_profiles SET sgp_customer_id = ?, updated_at = UTC_TIMESTAMP() WHERE cpf_hash = ?",
          [input.sgpCustomerId, input.cpfHash]
        );
        return { ...existing, sgpCustomerId: input.sgpCustomerId };
      }
      return existing;
    }

    // Mesma corrida que a versao SQLite trata: cpf_hash e PRIMARY KEY, entao
    // um insert duplicado falha (ER_DUP_ENTRY) e buscamos o ja existente.
    try {
      await this.pool.execute(
        "INSERT INTO customer_auth_profiles (cpf_hash, cpf_last_digits, sgp_customer_id) VALUES (?, ?, ?)",
        [input.cpfHash, input.cpfLastDigits, input.sgpCustomerId ?? null]
      );
    } catch {
      // ignora conflito de PK, busca abaixo
    }

    const created = await this.findByCpfHash(input.cpfHash);
    if (!created) {
      throw new Error(`Failed to create customer_auth_profiles row for cpf_hash ${input.cpfHash.slice(0, 8)}...`);
    }
    return created;
  }

  async markFirstAccessCompleted(cpfHash: string, when: Date): Promise<void> {
    await this.pool.execute(
      "UPDATE customer_auth_profiles SET first_access_completed = 1, password_changed_at = ?, updated_at = UTC_TIMESTAMP() WHERE cpf_hash = ?",
      [when.toISOString(), cpfHash]
    );
  }

  async markPasswordChanged(cpfHash: string, when: Date): Promise<void> {
    await this.pool.execute(
      "UPDATE customer_auth_profiles SET password_changed_at = ?, updated_at = UTC_TIMESTAMP() WHERE cpf_hash = ?",
      [when.toISOString(), cpfHash]
    );
  }

  async recordSuccessfulLogin(cpfHash: string, ipHash: string | undefined, when: Date): Promise<void> {
    await this.pool.execute(
      "UPDATE customer_auth_profiles SET last_login_at = ?, last_login_ip_hash = ?, updated_at = UTC_TIMESTAMP() WHERE cpf_hash = ?",
      [when.toISOString(), ipHash ?? null, cpfHash]
    );
  }

  async setPasswordHash(cpfHash: string, passwordHash: string, when: Date): Promise<void> {
    await this.pool.execute(
      "UPDATE customer_auth_profiles SET password_hash = ?, password_changed_at = ?, updated_at = UTC_TIMESTAMP() WHERE cpf_hash = ?",
      [passwordHash, when.toISOString(), cpfHash]
    );
  }
}
