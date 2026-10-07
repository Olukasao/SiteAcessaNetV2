import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export type AuthAuditEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "FIRST_ACCESS_PASSWORD_CHANGE_SUCCESS"
  | "SESSION_CREATED"
  | "SESSION_REVOKED"
  | "LOGOUT"
  | "RATE_LIMIT_TRIGGERED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_CODE_VERIFIED"
  | "PASSWORD_RESET_COMPLETED"
  | "PASSWORD_CHANGED";

/** Motivos de falha genericos e seguros para auditoria. NUNCA incluir a senha digitada, o codigo OTP ou qualquer dado sensivel aqui. */
export type AuthFailureReason =
  | "INVALID_CREDENTIALS"
  | "CPF_INVALID"
  | "CUSTOMER_NOT_FOUND"
  | "SGP_UNAVAILABLE"
  | "PASSWORD_POLICY_REJECTED"
  | "PASSWORD_MISMATCH"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS_SETUP"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_ATTEMPTS_EXCEEDED"
  | "OTP_NOT_FOUND"
  | "RESET_TOKEN_INVALID"
  | "RESET_TOKEN_EXPIRED"
  | "EMAIL_UNAVAILABLE"
  | "EMAIL_SEND_FAILED";

export interface AuthAuditLogInput {
  eventType: AuthAuditEventType;
  customerId?: string | null | undefined;
  cpfHash?: string | null | undefined;
  cpfMasked?: string | null | undefined;
  ipHash?: string | null | undefined;
  userAgent?: string | null | undefined;
  status: "SUCCESS" | "FAILED";
  failureReason?: AuthFailureReason | null | undefined;
  /** Apenas campos explicitamente seguros. NUNCA passar req.body aqui. */
  metadata?: Record<string, string | number | boolean> | null | undefined;
}

export interface AuditLogRepository {
  record(input: AuthAuditLogInput): Promise<void>;
}

const USER_AGENT_MAX_LENGTH = 255;

export class SqliteAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: DatabaseSync) {}

  async record(input: AuthAuditLogInput): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO auth_audit_logs
          (event_type, customer_id, cpf_hash, cpf_masked, ip_hash, user_agent, status, failure_reason, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.eventType,
        input.customerId ?? null,
        input.cpfHash ?? null,
        input.cpfMasked ?? null,
        input.ipHash ?? null,
        input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
        input.status,
        input.failureReason ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null
      );
  }
}

export class MysqlAuditLogRepository implements AuditLogRepository {
  constructor(private readonly pool: Pool) {}

  async record(input: AuthAuditLogInput): Promise<void> {
    await this.pool.execute(
      `INSERT INTO auth_audit_logs
        (event_type, customer_id, cpf_hash, cpf_masked, ip_hash, user_agent, status, failure_reason, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.eventType,
        input.customerId ?? null,
        input.cpfHash ?? null,
        input.cpfMasked ?? null,
        input.ipHash ?? null,
        input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
        input.status,
        input.failureReason ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null
      ]
    );
  }
}
