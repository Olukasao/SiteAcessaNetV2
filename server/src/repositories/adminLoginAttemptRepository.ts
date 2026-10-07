import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export interface AdminLoginAttemptRule {
  maxAttempts: number;
  windowMs: number;
  softDelayStartAt: number;
}

export interface AdminLoginAttemptOutcome {
  blocked: boolean;
  attemptCount: number;
  retryAfterSeconds: number;
}

export interface AdminLoginAttemptRepository {
  isBlocked(emailHash: string, ipHash: string, now?: Date): Promise<AdminLoginAttemptOutcome>;
  registerFailure(emailHash: string, ipHash: string, rule: AdminLoginAttemptRule, now?: Date): Promise<AdminLoginAttemptOutcome>;
  registerSuccess(emailHash: string, ipHash: string): Promise<void>;
}

/** Mesmo algoritmo de repositories/loginAttemptRepository.ts (atraso progressivo, bloqueio pela janela) -- espelhado, nao reaproveitado, para nao arriscar o login de cliente ao tocar numa tabela/coluna compartilhada. */
function computeOutcome(attemptCount: number, rule: AdminLoginAttemptRule): { blocked: boolean; retryAfterSeconds: number } {
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

interface AdminLoginAttemptRow {
  email_hash: string;
  ip_hash: string;
  attempt_count: number;
  window_started_at: string;
  blocked_until: string | null;
}

export class SqliteAdminLoginAttemptRepository implements AdminLoginAttemptRepository {
  constructor(private readonly db: DatabaseSync) {}

  private getRow(emailHash: string, ipHash: string) {
    return this.db
      .prepare("SELECT * FROM admin_login_attempts WHERE email_hash = ? AND ip_hash = ?")
      .get(emailHash, ipHash) as AdminLoginAttemptRow | undefined;
  }

  async isBlocked(emailHash: string, ipHash: string, now = new Date()): Promise<AdminLoginAttemptOutcome> {
    const row = this.getRow(emailHash, ipHash);
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

  async registerFailure(
    emailHash: string,
    ipHash: string,
    rule: AdminLoginAttemptRule,
    now = new Date()
  ): Promise<AdminLoginAttemptOutcome> {
    const existing = this.getRow(emailHash, ipHash);
    const windowExpired = existing
      ? new Date(existing.window_started_at).getTime() + rule.windowMs < now.getTime()
      : true;

    const attemptCount = windowExpired || !existing ? 1 : existing.attempt_count + 1;
    const outcome = computeOutcome(attemptCount, rule);
    const blockedUntil = outcome.blocked ? new Date(now.getTime() + outcome.retryAfterSeconds * 1000) : null;

    if (!existing || windowExpired) {
      this.db
        .prepare(
          `INSERT INTO admin_login_attempts (email_hash, ip_hash, attempt_count, window_started_at, blocked_until, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(email_hash, ip_hash) DO UPDATE SET
             attempt_count = excluded.attempt_count,
             window_started_at = excluded.window_started_at,
             blocked_until = excluded.blocked_until,
             updated_at = datetime('now')`
        )
        .run(emailHash, ipHash, attemptCount, now.toISOString(), blockedUntil ? blockedUntil.toISOString() : null);
    } else {
      this.db
        .prepare(
          "UPDATE admin_login_attempts SET attempt_count = ?, blocked_until = ?, updated_at = datetime('now') WHERE email_hash = ? AND ip_hash = ?"
        )
        .run(attemptCount, blockedUntil ? blockedUntil.toISOString() : null, emailHash, ipHash);
    }

    return { blocked: outcome.blocked, attemptCount, retryAfterSeconds: outcome.retryAfterSeconds };
  }

  async registerSuccess(emailHash: string, ipHash: string): Promise<void> {
    this.db.prepare("DELETE FROM admin_login_attempts WHERE email_hash = ? AND ip_hash = ?").run(emailHash, ipHash);
  }
}

export class MysqlAdminLoginAttemptRepository implements AdminLoginAttemptRepository {
  constructor(private readonly pool: Pool) {}

  private async getRow(emailHash: string, ipHash: string) {
    const [rows] = await this.pool.execute("SELECT * FROM admin_login_attempts WHERE email_hash = ? AND ip_hash = ?", [
      emailHash,
      ipHash
    ]);
    return (rows as AdminLoginAttemptRow[])[0];
  }

  async isBlocked(emailHash: string, ipHash: string, now = new Date()): Promise<AdminLoginAttemptOutcome> {
    const row = await this.getRow(emailHash, ipHash);
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

  async registerFailure(
    emailHash: string,
    ipHash: string,
    rule: AdminLoginAttemptRule,
    now = new Date()
  ): Promise<AdminLoginAttemptOutcome> {
    const existing = await this.getRow(emailHash, ipHash);
    const windowExpired = existing
      ? new Date(existing.window_started_at).getTime() + rule.windowMs < now.getTime()
      : true;

    const attemptCount = windowExpired || !existing ? 1 : existing.attempt_count + 1;
    const outcome = computeOutcome(attemptCount, rule);
    const blockedUntil = outcome.blocked ? new Date(now.getTime() + outcome.retryAfterSeconds * 1000) : null;

    if (!existing || windowExpired) {
      await this.pool.execute(
        `INSERT INTO admin_login_attempts (email_hash, ip_hash, attempt_count, window_started_at, blocked_until, updated_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           attempt_count = VALUES(attempt_count),
           window_started_at = VALUES(window_started_at),
           blocked_until = VALUES(blocked_until),
           updated_at = UTC_TIMESTAMP()`,
        [emailHash, ipHash, attemptCount, now.toISOString(), blockedUntil ? blockedUntil.toISOString() : null]
      );
    } else {
      await this.pool.execute(
        "UPDATE admin_login_attempts SET attempt_count = ?, blocked_until = ?, updated_at = UTC_TIMESTAMP() WHERE email_hash = ? AND ip_hash = ?",
        [attemptCount, blockedUntil ? blockedUntil.toISOString() : null, emailHash, ipHash]
      );
    }

    return { blocked: outcome.blocked, attemptCount, retryAfterSeconds: outcome.retryAfterSeconds };
  }

  async registerSuccess(emailHash: string, ipHash: string): Promise<void> {
    await this.pool.execute("DELETE FROM admin_login_attempts WHERE email_hash = ? AND ip_hash = ?", [
      emailHash,
      ipHash
    ]);
  }
}
