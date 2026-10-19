import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export interface LoginAttemptRule {
  /** Numero de falhas que ativa o rate limit completo. */
  maxAttempts: number;
  /** Janela de tempo em ms para contar/expirar tentativas e duracao do bloqueio completo. */
  windowMs: number;
  /** A partir de qual numero de falha comeca o atraso progressivo. Antes disso, sem atraso. */
  softDelayStartAt: number;
}

export interface LoginAttemptOutcome {
  blocked: boolean;
  attemptCount: number;
  retryAfterSeconds: number;
}

export interface LoginAttemptRepository {
  isBlocked(cpfHash: string, ipHash: string, now?: Date): Promise<LoginAttemptOutcome>;
  registerFailure(cpfHash: string, ipHash: string, rule: LoginAttemptRule, now?: Date): Promise<LoginAttemptOutcome>;
  registerSuccess(cpfHash: string, ipHash: string): Promise<void>;
}

/**
 * Atraso progressivo: 1a/2a falha sem atraso; a partir da
 * softDelayStartAt-esima falha, atraso crescente de 2s por tentativa,
 * limitado pela janela; ao atingir maxAttempts, bloqueio pela janela
 * inteira (rate limit), nunca permanente.
 */
function computeOutcome(attemptCount: number, rule: LoginAttemptRule): { blocked: boolean; retryAfterSeconds: number } {
  if (attemptCount >= rule.maxAttempts) {
    return { blocked: true, retryAfterSeconds: Math.ceil(rule.windowMs / 1000) };
  }

  if (attemptCount >= rule.softDelayStartAt) {
    const stepsAboveSoft = attemptCount - rule.softDelayStartAt + 1;
    const delayMs = Math.min(stepsAboveSoft * 2000, rule.windowMs);
    return { blocked: true, retryAfterSeconds: Math.ceil(delayMs / 1000) };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

interface LoginAttemptRow {
  cpf_hash: string;
  ip_hash: string;
  attempt_count: number;
  window_started_at: string;
  blocked_until: string | null;
}

export class SqliteLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly db: DatabaseSync) {}

  private getRow(cpfHash: string, ipHash: string) {
    return this.db
      .prepare("SELECT * FROM auth_login_attempts WHERE cpf_hash = ? AND ip_hash = ?")
      .get(cpfHash, ipHash) as LoginAttemptRow | undefined;
  }

  async isBlocked(cpfHash: string, ipHash: string, now = new Date()): Promise<LoginAttemptOutcome> {
    const row = this.getRow(cpfHash, ipHash);
    if (!row || !row.blocked_until) {
      return { blocked: false, attemptCount: row?.attempt_count ?? 0, retryAfterSeconds: 0 };
    }

    const blockedUntil = new Date(row.blocked_until);
    if (blockedUntil <= now) {
      return { blocked: false, attemptCount: row.attempt_count, retryAfterSeconds: 0 };
    }

    return {
      blocked: true,
      attemptCount: row.attempt_count,
      retryAfterSeconds: Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)
    };
  }

  async registerFailure(cpfHash: string, ipHash: string, rule: LoginAttemptRule, now = new Date()): Promise<LoginAttemptOutcome> {
    const existing = this.getRow(cpfHash, ipHash);
    const windowExpired = existing
      ? new Date(existing.window_started_at).getTime() + rule.windowMs < now.getTime()
      : true;

    const attemptCount = windowExpired || !existing ? 1 : existing.attempt_count + 1;
    const outcome = computeOutcome(attemptCount, rule);
    const blockedUntil = outcome.blocked ? new Date(now.getTime() + outcome.retryAfterSeconds * 1000) : null;

    if (!existing || windowExpired) {
      this.db
        .prepare(
          `INSERT INTO auth_login_attempts (cpf_hash, ip_hash, attempt_count, window_started_at, blocked_until, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(cpf_hash, ip_hash) DO UPDATE SET
             attempt_count = excluded.attempt_count,
             window_started_at = excluded.window_started_at,
             blocked_until = excluded.blocked_until,
             updated_at = datetime('now')`
        )
        .run(cpfHash, ipHash, attemptCount, now.toISOString(), blockedUntil ? blockedUntil.toISOString() : null);
    } else {
      this.db
        .prepare(
          "UPDATE auth_login_attempts SET attempt_count = ?, blocked_until = ?, updated_at = datetime('now') WHERE cpf_hash = ? AND ip_hash = ?"
        )
        .run(attemptCount, blockedUntil ? blockedUntil.toISOString() : null, cpfHash, ipHash);
    }

    return { blocked: outcome.blocked, attemptCount, retryAfterSeconds: outcome.retryAfterSeconds };
  }

  async registerSuccess(cpfHash: string, ipHash: string): Promise<void> {
    this.db.prepare("DELETE FROM auth_login_attempts WHERE cpf_hash = ? AND ip_hash = ?").run(cpfHash, ipHash);
  }
}

export class MysqlLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly pool: Pool) {}

  private async getRow(cpfHash: string, ipHash: string) {
    const [rows] = await this.pool.execute("SELECT * FROM auth_login_attempts WHERE cpf_hash = ? AND ip_hash = ?", [
      cpfHash,
      ipHash
    ]);
    return (rows as LoginAttemptRow[])[0];
  }

  async isBlocked(cpfHash: string, ipHash: string, now = new Date()): Promise<LoginAttemptOutcome> {
    const row = await this.getRow(cpfHash, ipHash);
    if (!row || !row.blocked_until) {
      return { blocked: false, attemptCount: row?.attempt_count ?? 0, retryAfterSeconds: 0 };
    }

    const blockedUntil = new Date(row.blocked_until);
    if (blockedUntil <= now) {
      return { blocked: false, attemptCount: row.attempt_count, retryAfterSeconds: 0 };
    }

    return {
      blocked: true,
      attemptCount: row.attempt_count,
      retryAfterSeconds: Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)
    };
  }

  async registerFailure(cpfHash: string, ipHash: string, rule: LoginAttemptRule, now = new Date()): Promise<LoginAttemptOutcome> {
    const existing = await this.getRow(cpfHash, ipHash);
    const windowExpired = existing
      ? new Date(existing.window_started_at).getTime() + rule.windowMs < now.getTime()
      : true;

    const attemptCount = windowExpired || !existing ? 1 : existing.attempt_count + 1;
    const outcome = computeOutcome(attemptCount, rule);
    const blockedUntil = outcome.blocked ? new Date(now.getTime() + outcome.retryAfterSeconds * 1000) : null;

    if (!existing || windowExpired) {
      await this.pool.execute(
        `INSERT INTO auth_login_attempts (cpf_hash, ip_hash, attempt_count, window_started_at, blocked_until, updated_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           attempt_count = VALUES(attempt_count),
           window_started_at = VALUES(window_started_at),
           blocked_until = VALUES(blocked_until),
           updated_at = UTC_TIMESTAMP()`,
        [cpfHash, ipHash, attemptCount, now.toISOString(), blockedUntil ? blockedUntil.toISOString() : null]
      );
    } else {
      await this.pool.execute(
        "UPDATE auth_login_attempts SET attempt_count = ?, blocked_until = ?, updated_at = UTC_TIMESTAMP() WHERE cpf_hash = ? AND ip_hash = ?",
        [attemptCount, blockedUntil ? blockedUntil.toISOString() : null, cpfHash, ipHash]
      );
    }

    return { blocked: outcome.blocked, attemptCount, retryAfterSeconds: outcome.retryAfterSeconds };
  }

  async registerSuccess(cpfHash: string, ipHash: string): Promise<void> {
    await this.pool.execute("DELETE FROM auth_login_attempts WHERE cpf_hash = ? AND ip_hash = ?", [cpfHash, ipHash]);
  }
}
