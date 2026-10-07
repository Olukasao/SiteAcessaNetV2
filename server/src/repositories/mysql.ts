import mysql, { type Pool } from "mysql2/promise";

export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Alternativa a sqlite.ts (ver dbDriver em config.ts): mesmo dado (auth de
 * cliente/admin, sessao, avisos), banco gerenciado pela Hostinger em vez de
 * arquivo dentro da pasta que o deploy apaga/recria. timezone:"Z" forca o
 * driver a tratar toda coluna de data como UTC na leitura/escrita,
 * consistente com datetime('now') do SQLite (sempre UTC) e com
 * `.toISOString()` usado em todo o resto do codigo.
 */
export function createMysqlPool(config: MysqlConnectionConfig): Pool {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "Z",
    dateStrings: true
  });
}

/**
 * Todas as colunas de data ficam VARCHAR (nao DATETIME nativo) de proposito:
 * cada repositorio ja parseia essas colunas com `new Date(row.campo)`
 * esperando uma STRING (ver fromRow em cada *Repository.ts) -- manter como
 * texto evita qualquer ambiguidade de tipo entre os dois drivers e preserva
 * o mesmo formato que o SQLite ja gravava. `dateStrings: true` acima reforça
 * isso (sem ele, o driver devolveria objetos Date pra colunas DATETIME).
 */
export async function migrateMysql(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_auth_profiles (
      cpf_hash VARCHAR(191) PRIMARY KEY,
      sgp_customer_id VARCHAR(191),
      cpf_last_digits VARCHAR(16),
      password_hash VARCHAR(255),
      first_access_completed TINYINT NOT NULL DEFAULT 0,
      password_changed_at VARCHAR(32),
      last_login_at VARCHAR(32),
      last_login_ip_hash VARCHAR(191),
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      updated_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP())
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id VARCHAR(191) PRIMARY KEY,
      session_token_hash VARCHAR(191) NOT NULL,
      customer_id VARCHAR(191) NOT NULL,
      cpf_hash VARCHAR(191) NOT NULL,
      expires_at VARCHAR(32) NOT NULL,
      last_activity_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      revoked_at VARCHAR(32),
      ip_hash VARCHAR(191),
      user_agent VARCHAR(255),
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_auth_sessions_cpf_hash (cpf_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      cpf_hash VARCHAR(191) NOT NULL,
      ip_hash VARCHAR(191) NOT NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      window_started_at VARCHAR(32) NOT NULL,
      blocked_until VARCHAR(32),
      updated_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      PRIMARY KEY (cpf_hash, ip_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(64) NOT NULL,
      customer_id VARCHAR(191),
      cpf_hash VARCHAR(191),
      cpf_masked VARCHAR(32),
      ip_hash VARCHAR(191),
      user_agent VARCHAR(255),
      status VARCHAR(16) NOT NULL,
      failure_reason VARCHAR(64),
      metadata TEXT,
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP())
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id VARCHAR(191) PRIMARY KEY,
      cpf_hash VARCHAR(191) NOT NULL,
      otp_hash VARCHAR(191) NOT NULL,
      otp_expires_at VARCHAR(32) NOT NULL,
      otp_attempts INT NOT NULL DEFAULT 0,
      otp_used_at VARCHAR(32),
      reset_token_hash VARCHAR(191),
      reset_token_expires_at VARCHAR(32),
      reset_token_used_at VARCHAR(32),
      ip_hash VARCHAR(191),
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_password_reset_requests_cpf_hash (cpf_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id VARCHAR(191) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      updated_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP())
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id VARCHAR(191) PRIMARY KEY,
      session_token_hash VARCHAR(191) NOT NULL,
      admin_user_id VARCHAR(191) NOT NULL,
      expires_at VARCHAR(32) NOT NULL,
      last_activity_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      revoked_at VARCHAR(32),
      ip_hash VARCHAR(191),
      user_agent VARCHAR(255),
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_admin_sessions_admin_user (admin_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      email_hash VARCHAR(191) NOT NULL,
      ip_hash VARCHAR(191) NOT NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      window_started_at VARCHAR(32) NOT NULL,
      blocked_until VARCHAR(32),
      updated_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      PRIMARY KEY (email_hash, ip_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS central_notices (
      id VARCHAR(191) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      image_url VARCHAR(1024),
      type VARCHAR(32) NOT NULL,
      display VARCHAR(32) NOT NULL,
      priority VARCHAR(16) NOT NULL DEFAULT 'normal',
      dismissible TINYINT NOT NULL DEFAULT 1,
      frequency VARCHAR(32) NOT NULL DEFAULT 'always',
      origin VARCHAR(32) NOT NULL DEFAULT 'manual',
      audience_type VARCHAR(32) NOT NULL DEFAULT 'all',
      audience_filter TEXT,
      starts_at VARCHAR(32),
      ends_at VARCHAR(32),
      active TINYINT NOT NULL DEFAULT 1,
      deleted_at VARCHAR(32),
      version INT NOT NULL DEFAULT 1,
      created_by VARCHAR(191) NOT NULL,
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      updated_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_central_notices_active (active, starts_at, ends_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS central_notice_views (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      notice_id VARCHAR(191) NOT NULL,
      customer_id VARCHAR(191) NOT NULL,
      viewed_version INT NOT NULL,
      first_viewed_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      last_viewed_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      view_count INT NOT NULL DEFAULT 1,
      UNIQUE KEY uq_central_notice_views (notice_id, customer_id),
      INDEX idx_central_notice_views_notice (notice_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admin_user_id VARCHAR(191),
      admin_email VARCHAR(255),
      action VARCHAR(64) NOT NULL,
      notice_id VARCHAR(191),
      ip_hash VARCHAR(191),
      user_agent VARCHAR(255),
      before_snapshot TEXT,
      after_snapshot TEXT,
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_admin_audit_logs_notice (notice_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS central_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(191) NOT NULL UNIQUE,
      customer_id VARCHAR(191) NOT NULL,
      cpf_hash VARCHAR(191),
      cpf_masked VARCHAR(32),
      customer_name VARCHAR(255),
      sgp_customer_id VARCHAR(191),
      first_contract_id VARCHAR(191),
      ip_hash VARCHAR(191),
      user_agent VARCHAR(500),
      device_type VARCHAR(32),
      started_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      last_activity_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      ended_at VARCHAR(32),
      INDEX idx_central_sessions_customer (customer_id),
      INDEX idx_central_sessions_contract (first_contract_id),
      INDEX idx_central_sessions_started (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

	  await pool.query(`
	    CREATE TABLE IF NOT EXISTS central_activity_logs (
	      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      customer_id VARCHAR(191) NOT NULL,
      cpf_hash VARCHAR(191),
      cpf_masked VARCHAR(32),
      customer_name VARCHAR(255),
      sgp_customer_id VARCHAR(191),
      contract_id VARCHAR(191),
      session_id VARCHAR(191),
      event_type VARCHAR(60) NOT NULL,
      page VARCHAR(120),
      metadata TEXT,
      ip_hash VARCHAR(191),
      user_agent VARCHAR(500),
      device_type VARCHAR(32),
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_central_activity_customer (customer_id),
      INDEX idx_central_activity_contract (contract_id),
      INDEX idx_central_activity_event (event_type),
      INDEX idx_central_activity_created (created_at),
	      INDEX idx_central_activity_session (session_id)
	    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	  `);

	  await pool.query(`
	    CREATE TABLE IF NOT EXISTS bug_reports (
	      id BIGINT AUTO_INCREMENT PRIMARY KEY,
	      customer_id VARCHAR(191) NOT NULL,
	      cpf_hash VARCHAR(191),
	      cpf_masked VARCHAR(32),
	      customer_name VARCHAR(255),
	      sgp_customer_id VARCHAR(191),
	      contract_id VARCHAR(191),
	      category VARCHAR(100) NOT NULL,
	      description TEXT NOT NULL,
	      page VARCHAR(500),
	      url TEXT,
	      user_agent TEXT,
	      frontend_version VARCHAR(100),
	      context_json JSON,
	      status VARCHAR(32) NOT NULL DEFAULT 'novo',
	      admin_notes TEXT,
	      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
	      updated_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
	      INDEX idx_bug_reports_status (status),
	      INDEX idx_bug_reports_customer (customer_id),
	      INDEX idx_bug_reports_contract (contract_id),
	      INDEX idx_bug_reports_category (category),
	      INDEX idx_bug_reports_created (created_at)
	    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	  `);

	  await pool.query(`
	    CREATE TABLE IF NOT EXISTS bug_report_history (
	      id BIGINT AUTO_INCREMENT PRIMARY KEY,
	      report_id BIGINT NOT NULL,
	      admin_user_id VARCHAR(191),
	      admin_email VARCHAR(255),
	      action VARCHAR(64) NOT NULL,
	      before_status VARCHAR(32),
	      after_status VARCHAR(32),
	      before_notes TEXT,
	      after_notes TEXT,
	      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
	      INDEX idx_bug_report_history_report (report_id)
	    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS network_incidents (
      id VARCHAR(191) PRIMARY KEY,
      external_alert_id VARCHAR(191) NOT NULL,
      source VARCHAR(32) NOT NULL DEFAULT 'OLT_CLOUD',
      type VARCHAR(32) NOT NULL DEFAULT 'PON_OUTAGE',
      status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
      olt_id VARCHAR(191),
      olt_name VARCHAR(255),
      slot VARCHAR(64),
      pon VARCHAR(64),
      pon_id VARCHAR(64),
      started_at VARCHAR(32),
      ended_at VARCHAR(32),
      affected_devices_count INT,
      total_devices_count INT,
      mapped_contracts_count INT NOT NULL DEFAULT 0,
      unmapped_equipment_count INT NOT NULL DEFAULT 0,
      mapping_status VARCHAR(16) NOT NULL DEFAULT 'OK',
      created_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      updated_at VARCHAR(32) NOT NULL DEFAULT (UTC_TIMESTAMP()),
      UNIQUE KEY uq_network_incidents_external_alert (external_alert_id),
      INDEX idx_network_incidents_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS network_incident_contracts (
      incident_id VARCHAR(191) NOT NULL,
      contract_id VARCHAR(191) NOT NULL,
      PRIMARY KEY (incident_id, contract_id),
      INDEX idx_network_incident_contracts_contract (contract_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
	}
