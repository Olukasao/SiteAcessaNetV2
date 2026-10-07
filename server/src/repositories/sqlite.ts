import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Unico dado que precisa sobreviver a um restart do processo: autenticacao
 * (senha, sessao, tentativas de login, auditoria). Usa node:sqlite (builtin
 * do Node >= 22.5, sem dependencia nativa pra compilar) em vez de MariaDB
 * porque este backend nao tem credenciais de administrador do MariaDB desta
 * maquina -- e porque um arquivo local e suficiente pro volume de um unico
 * servico de autenticacao de clientes.
 */
export function createDatabase(sqlitePath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const db = new DatabaseSync(sqlitePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_auth_profiles (
      cpf_hash TEXT PRIMARY KEY,
      sgp_customer_id TEXT,
      cpf_last_digits TEXT,
      password_hash TEXT,
      first_access_completed INTEGER NOT NULL DEFAULT 0,
      password_changed_at TEXT,
      last_login_at TEXT,
      last_login_ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      session_token_hash TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      cpf_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_cpf_hash ON auth_sessions (cpf_hash);

    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      cpf_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      window_started_at TEXT NOT NULL,
      blocked_until TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (cpf_hash, ip_hash)
    );

    CREATE TABLE IF NOT EXISTS auth_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      customer_id TEXT,
      cpf_hash TEXT,
      cpf_masked TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      status TEXT NOT NULL,
      failure_reason TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id TEXT PRIMARY KEY,
      cpf_hash TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      otp_expires_at TEXT NOT NULL,
      otp_attempts INTEGER NOT NULL DEFAULT 0,
      otp_used_at TEXT,
      reset_token_hash TEXT,
      reset_token_expires_at TEXT,
      reset_token_used_at TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_requests_cpf_hash ON password_reset_requests (cpf_hash);

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      session_token_hash TEXT NOT NULL,
      admin_user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user ON admin_sessions (admin_user_id);

    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      email_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      window_started_at TEXT NOT NULL,
      blocked_until TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (email_hash, ip_hash)
    );

    CREATE TABLE IF NOT EXISTS central_notices (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      image_url TEXT,
      type TEXT NOT NULL,
      display TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      dismissible INTEGER NOT NULL DEFAULT 1,
      frequency TEXT NOT NULL DEFAULT 'always',
      origin TEXT NOT NULL DEFAULT 'manual',
      audience_type TEXT NOT NULL DEFAULT 'all',
      audience_filter TEXT,
      starts_at TEXT,
      ends_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_central_notices_active ON central_notices (active, starts_at, ends_at);

    CREATE TABLE IF NOT EXISTS central_notice_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notice_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      viewed_version INTEGER NOT NULL,
      first_viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      view_count INTEGER NOT NULL DEFAULT 1,
      UNIQUE (notice_id, customer_id)
    );
    CREATE INDEX IF NOT EXISTS idx_central_notice_views_notice ON central_notice_views (notice_id);

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id TEXT,
      admin_email TEXT,
      action TEXT NOT NULL,
      notice_id TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      before_snapshot TEXT,
      after_snapshot TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_notice ON admin_audit_logs (notice_id);

    CREATE TABLE IF NOT EXISTS central_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      cpf_hash TEXT,
      cpf_masked TEXT,
      customer_name TEXT,
      sgp_customer_id TEXT,
      first_contract_id TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      device_type TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_central_sessions_customer ON central_sessions (customer_id);
    CREATE INDEX IF NOT EXISTS idx_central_sessions_contract ON central_sessions (first_contract_id);
    CREATE INDEX IF NOT EXISTS idx_central_sessions_started ON central_sessions (started_at);

    CREATE TABLE IF NOT EXISTS central_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      cpf_hash TEXT,
      cpf_masked TEXT,
      customer_name TEXT,
      sgp_customer_id TEXT,
      contract_id TEXT,
      session_id TEXT,
      event_type TEXT NOT NULL,
      page TEXT,
      metadata TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      device_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_central_activity_customer ON central_activity_logs (customer_id);
    CREATE INDEX IF NOT EXISTS idx_central_activity_contract ON central_activity_logs (contract_id);
	    CREATE INDEX IF NOT EXISTS idx_central_activity_event ON central_activity_logs (event_type);
	    CREATE INDEX IF NOT EXISTS idx_central_activity_created ON central_activity_logs (created_at);
	    CREATE INDEX IF NOT EXISTS idx_central_activity_session ON central_activity_logs (session_id);

	    CREATE TABLE IF NOT EXISTS bug_reports (
	      id INTEGER PRIMARY KEY AUTOINCREMENT,
	      customer_id TEXT NOT NULL,
	      cpf_hash TEXT,
	      cpf_masked TEXT,
	      customer_name TEXT,
	      sgp_customer_id TEXT,
	      contract_id TEXT,
	      category TEXT NOT NULL,
	      description TEXT NOT NULL,
	      page TEXT,
	      url TEXT,
	      user_agent TEXT,
	      frontend_version TEXT,
	      context_json TEXT,
	      status TEXT NOT NULL DEFAULT 'novo',
	      admin_notes TEXT,
	      created_at TEXT NOT NULL DEFAULT (datetime('now')),
	      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	    );
	    CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports (status);
	    CREATE INDEX IF NOT EXISTS idx_bug_reports_customer ON bug_reports (customer_id);
	    CREATE INDEX IF NOT EXISTS idx_bug_reports_contract ON bug_reports (contract_id);
	    CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports (category);
	    CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports (created_at);

	    CREATE TABLE IF NOT EXISTS bug_report_history (
	      id INTEGER PRIMARY KEY AUTOINCREMENT,
	      report_id INTEGER NOT NULL,
	      admin_user_id TEXT,
	      admin_email TEXT,
	      action TEXT NOT NULL,
	      before_status TEXT,
	      after_status TEXT,
	      before_notes TEXT,
	      after_notes TEXT,
	      created_at TEXT NOT NULL DEFAULT (datetime('now'))
	    );
	    CREATE INDEX IF NOT EXISTS idx_bug_report_history_report ON bug_report_history (report_id);

    CREATE TABLE IF NOT EXISTS network_incidents (
      id TEXT PRIMARY KEY,
      external_alert_id TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'OLT_CLOUD',
      type TEXT NOT NULL DEFAULT 'PON_OUTAGE',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      olt_id TEXT,
      olt_name TEXT,
      slot TEXT,
      pon TEXT,
      pon_id TEXT,
      started_at TEXT,
      ended_at TEXT,
      affected_devices_count INTEGER,
      total_devices_count INTEGER,
      mapped_contracts_count INTEGER NOT NULL DEFAULT 0,
      unmapped_equipment_count INTEGER NOT NULL DEFAULT 0,
      mapping_status TEXT NOT NULL DEFAULT 'OK',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_network_incidents_external_alert ON network_incidents (external_alert_id);
    CREATE INDEX IF NOT EXISTS idx_network_incidents_status ON network_incidents (status);

    CREATE TABLE IF NOT EXISTS network_incident_contracts (
      incident_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      PRIMARY KEY (incident_id, contract_id)
    );
    CREATE INDEX IF NOT EXISTS idx_network_incident_contracts_contract ON network_incident_contracts (contract_id);
	  `);

  addColumnIfMissing(db, "central_notices", "image_url", "TEXT");
}

/**
 * CREATE TABLE IF NOT EXISTS nao adiciona coluna em tabela que ja existe --
 * usado quando um campo novo (ex.: image_url) precisa chegar em banco que ja
 * tinha a tabela criada por uma versao anterior deste arquivo. Sempre
 * aditivo (nunca DROP/RENAME), idempotente (seguro rodar em todo boot).
 */
function addColumnIfMissing(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((entry) => entry.name === column)) {
    return;
  }

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}
