import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export interface PasswordResetRequestRecord {
  id: string;
  cpfHash: string;
  otpHash: string;
  otpExpiresAt: Date;
  otpAttempts: number;
  otpUsedAt: Date | null;
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
  resetTokenUsedAt: Date | null;
  ipHash: string | null;
  createdAt: Date;
}

export interface CreatePasswordResetRequestInput {
  id: string;
  cpfHash: string;
  otpHash: string;
  otpExpiresAt: Date;
  ipHash?: string | null | undefined;
}

export interface PasswordResetRepository {
  /** Invalida (marca como usado) qualquer solicitacao ainda ativa do mesmo cpf_hash e cria uma nova: so o OTP mais recente vale. */
  createRequest(input: CreatePasswordResetRequestInput): Promise<PasswordResetRequestRecord>;
  /** Ultima solicitacao (usada ou nao) do cpf_hash -- usada so para calcular o cooldown de reenvio. */
  findLatestByCpfHash(cpfHash: string): Promise<PasswordResetRequestRecord | null>;
  /** Solicitacao ativa (otp_used_at NULL) mais recente do cpf_hash -- usada para validar o codigo informado. */
  findActiveByCpfHash(cpfHash: string): Promise<PasswordResetRequestRecord | null>;
  incrementOtpAttempts(id: string): Promise<number>;
  markOtpUsed(id: string, when: Date): Promise<void>;
  setResetToken(id: string, resetTokenHash: string, resetTokenExpiresAt: Date): Promise<void>;
  findByResetTokenHash(resetTokenHash: string): Promise<PasswordResetRequestRecord | null>;
  markResetTokenUsed(id: string, when: Date): Promise<void>;
}

interface PasswordResetRequestRow {
  id: string;
  cpf_hash: string;
  otp_hash: string;
  otp_expires_at: string;
  otp_attempts: number;
  otp_used_at: string | null;
  reset_token_hash: string | null;
  reset_token_expires_at: string | null;
  reset_token_used_at: string | null;
  ip_hash: string | null;
  created_at: string;
}

function fromRow(row: PasswordResetRequestRow): PasswordResetRequestRecord {
  return {
    id: row.id,
    cpfHash: row.cpf_hash,
    otpHash: row.otp_hash,
    otpExpiresAt: new Date(row.otp_expires_at),
    otpAttempts: row.otp_attempts,
    otpUsedAt: row.otp_used_at ? new Date(row.otp_used_at) : null,
    resetTokenHash: row.reset_token_hash,
    resetTokenExpiresAt: row.reset_token_expires_at ? new Date(row.reset_token_expires_at) : null,
    resetTokenUsedAt: row.reset_token_used_at ? new Date(row.reset_token_used_at) : null,
    ipHash: row.ip_hash,
    createdAt: new Date(row.created_at)
  };
}

export class SqlitePasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: DatabaseSync) {}

  async createRequest(input: CreatePasswordResetRequestInput): Promise<PasswordResetRequestRecord> {
    this.db
      .prepare("UPDATE password_reset_requests SET otp_used_at = datetime('now') WHERE cpf_hash = ? AND otp_used_at IS NULL")
      .run(input.cpfHash);

    this.db
      .prepare(
        "INSERT INTO password_reset_requests (id, cpf_hash, otp_hash, otp_expires_at, ip_hash) VALUES (?, ?, ?, ?, ?)"
      )
      .run(input.id, input.cpfHash, input.otpHash, input.otpExpiresAt.toISOString(), input.ipHash ?? null);

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create password_reset_requests row ${input.id}`);
    }
    return created;
  }

  async findLatestByCpfHash(cpfHash: string): Promise<PasswordResetRequestRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM password_reset_requests WHERE cpf_hash = ? ORDER BY created_at DESC LIMIT 1")
      .get(cpfHash) as PasswordResetRequestRow | undefined;
    return row ? fromRow(row) : null;
  }

  async findActiveByCpfHash(cpfHash: string): Promise<PasswordResetRequestRecord | null> {
    const row = this.db
      .prepare(
        "SELECT * FROM password_reset_requests WHERE cpf_hash = ? AND otp_used_at IS NULL ORDER BY created_at DESC LIMIT 1"
      )
      .get(cpfHash) as PasswordResetRequestRow | undefined;
    return row ? fromRow(row) : null;
  }

  async incrementOtpAttempts(id: string): Promise<number> {
    this.db.prepare("UPDATE password_reset_requests SET otp_attempts = otp_attempts + 1 WHERE id = ?").run(id);
    const row = this.db
      .prepare("SELECT otp_attempts FROM password_reset_requests WHERE id = ?")
      .get(id) as { otp_attempts: number } | undefined;
    return row?.otp_attempts ?? 0;
  }

  async markOtpUsed(id: string, when: Date): Promise<void> {
    this.db.prepare("UPDATE password_reset_requests SET otp_used_at = ? WHERE id = ?").run(when.toISOString(), id);
  }

  async setResetToken(id: string, resetTokenHash: string, resetTokenExpiresAt: Date): Promise<void> {
    this.db
      .prepare("UPDATE password_reset_requests SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?")
      .run(resetTokenHash, resetTokenExpiresAt.toISOString(), id);
  }

  async findByResetTokenHash(resetTokenHash: string): Promise<PasswordResetRequestRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM password_reset_requests WHERE reset_token_hash = ?")
      .get(resetTokenHash) as PasswordResetRequestRow | undefined;
    return row ? fromRow(row) : null;
  }

  async markResetTokenUsed(id: string, when: Date): Promise<void> {
    this.db
      .prepare("UPDATE password_reset_requests SET reset_token_used_at = ? WHERE id = ?")
      .run(when.toISOString(), id);
  }

  private async findById(id: string): Promise<PasswordResetRequestRecord | null> {
    const row = this.db.prepare("SELECT * FROM password_reset_requests WHERE id = ?").get(id) as
      | PasswordResetRequestRow
      | undefined;
    return row ? fromRow(row) : null;
  }
}

export class MysqlPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly pool: Pool) {}

  async createRequest(input: CreatePasswordResetRequestInput): Promise<PasswordResetRequestRecord> {
    await this.pool.execute(
      "UPDATE password_reset_requests SET otp_used_at = UTC_TIMESTAMP() WHERE cpf_hash = ? AND otp_used_at IS NULL",
      [input.cpfHash]
    );

    await this.pool.execute(
      "INSERT INTO password_reset_requests (id, cpf_hash, otp_hash, otp_expires_at, ip_hash) VALUES (?, ?, ?, ?, ?)",
      [input.id, input.cpfHash, input.otpHash, input.otpExpiresAt.toISOString(), input.ipHash ?? null]
    );

    const created = await this.findById(input.id);
    if (!created) {
      throw new Error(`Failed to create password_reset_requests row ${input.id}`);
    }
    return created;
  }

  async findLatestByCpfHash(cpfHash: string): Promise<PasswordResetRequestRecord | null> {
    const [rows] = await this.pool.execute(
      "SELECT * FROM password_reset_requests WHERE cpf_hash = ? ORDER BY created_at DESC LIMIT 1",
      [cpfHash]
    );
    const row = (rows as PasswordResetRequestRow[])[0];
    return row ? fromRow(row) : null;
  }

  async findActiveByCpfHash(cpfHash: string): Promise<PasswordResetRequestRecord | null> {
    const [rows] = await this.pool.execute(
      "SELECT * FROM password_reset_requests WHERE cpf_hash = ? AND otp_used_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [cpfHash]
    );
    const row = (rows as PasswordResetRequestRow[])[0];
    return row ? fromRow(row) : null;
  }

  async incrementOtpAttempts(id: string): Promise<number> {
    await this.pool.execute("UPDATE password_reset_requests SET otp_attempts = otp_attempts + 1 WHERE id = ?", [id]);
    const [rows] = await this.pool.execute("SELECT otp_attempts FROM password_reset_requests WHERE id = ?", [id]);
    const row = (rows as { otp_attempts: number }[])[0];
    return row?.otp_attempts ?? 0;
  }

  async markOtpUsed(id: string, when: Date): Promise<void> {
    await this.pool.execute("UPDATE password_reset_requests SET otp_used_at = ? WHERE id = ?", [
      when.toISOString(),
      id
    ]);
  }

  async setResetToken(id: string, resetTokenHash: string, resetTokenExpiresAt: Date): Promise<void> {
    await this.pool.execute(
      "UPDATE password_reset_requests SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?",
      [resetTokenHash, resetTokenExpiresAt.toISOString(), id]
    );
  }

  async findByResetTokenHash(resetTokenHash: string): Promise<PasswordResetRequestRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM password_reset_requests WHERE reset_token_hash = ?", [
      resetTokenHash
    ]);
    const row = (rows as PasswordResetRequestRow[])[0];
    return row ? fromRow(row) : null;
  }

  async markResetTokenUsed(id: string, when: Date): Promise<void> {
    await this.pool.execute("UPDATE password_reset_requests SET reset_token_used_at = ? WHERE id = ?", [
      when.toISOString(),
      id
    ]);
  }

  private async findById(id: string): Promise<PasswordResetRequestRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM password_reset_requests WHERE id = ?", [id]);
    const row = (rows as PasswordResetRequestRow[])[0];
    return row ? fromRow(row) : null;
  }
}
