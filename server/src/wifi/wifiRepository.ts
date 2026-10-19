import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

/**
 * Wi-Fi publico (captive portal do Grandstream), antes no AcessaNet Connect
 * (/home/noc/roteador-publico). Cadastro do visitante, consentimentos auditaveis
 * e o login temporario que o RADIUS confere para liberar a internet.
 *
 * Tabelas criadas aqui mesmo (CREATE TABLE IF NOT EXISTS na primeira chamada),
 * sempre aditivo: nunca DROP/ALTER destrutivo.
 */

export interface WifiVisitorInput {
  fullName: string;
  email: string;
  /** So digitos, com DDD. */
  phone: string;
}

export interface WifiSessionInput {
  visitorId: string;
  username: string;
  passwordHash: string;
  apMac: string | null;
  clientMac: string | null;
  ssid: string | null;
  expiresAt: Date;
}

export interface WifiSessionRecord {
  id: number;
  visitorId: string;
  username: string;
  passwordHash: string;
  clientMac: string | null;
  status: "pending" | "authorized";
  expiresAt: Date;
}

export interface WifiMarketingLead {
  visitorId: string;
  fullName: string;
  email: string;
  phone: string;
  /** Rede (SSID) do ultimo acesso -- o "estabelecimento" da tela Marketing. */
  establishment: string | null;
  registeredAt: string;
  marketingConsentAt: string;
}

export interface WifiRepository {
  /** Mesmo e-mail + celular = mesma pessoa (atualiza o nome). Retorna o id. */
  upsertVisitor(input: WifiVisitorInput, id: string): Promise<string>;
  /** Cada aceite/recusa e um registro novo, nunca sobrescrito (auditoria LGPD). */
  recordConsent(visitorId: string, purpose: "terms" | "marketing", granted: boolean, version: string): Promise<void>;
  createSession(input: WifiSessionInput): Promise<void>;
  findSessionByUsername(username: string): Promise<WifiSessionRecord | null>;
  markAuthorized(id: number, when: Date): Promise<void>;
  /** Quem tem o consentimento de marketing MAIS RECENTE = concedido. */
  listMarketingLeads(limit: number): Promise<WifiMarketingLead[]>;
  /** true se a pessoa estava na lista (consentimento de marketing mais recente = concedido). */
  isMarketingLead(visitorId: string): Promise<boolean>;
}

const iso = (date: Date) => date.toISOString();

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS wifi_visitors (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (email, phone)
  );
  CREATE TABLE IF NOT EXISTS wifi_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    granted INTEGER NOT NULL,
    version TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_wifi_consents_visitor ON wifi_consents (visitor_id, purpose, id);
  CREATE TABLE IF NOT EXISTS wifi_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    ap_mac TEXT,
    client_mac TEXT,
    ssid TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT NOT NULL,
    authorized_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_wifi_sessions_visitor ON wifi_sessions (visitor_id, id);
`;

const MYSQL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS wifi_visitors (
    id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(11) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    UNIQUE KEY uq_wifi_visitors_email_phone (email, phone)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS wifi_consents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    visitor_id VARCHAR(64) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    granted TINYINT(1) NOT NULL,
    version VARCHAR(32) NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    INDEX idx_wifi_consents_visitor (visitor_id, purpose, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS wifi_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    visitor_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(64) NOT NULL,
    ap_mac VARCHAR(32),
    client_mac VARCHAR(32),
    ssid VARCHAR(64),
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    expires_at VARCHAR(32) NOT NULL,
    authorized_at VARCHAR(32),
    created_at VARCHAR(32) NOT NULL,
    UNIQUE KEY uq_wifi_sessions_username (username),
    INDEX idx_wifi_sessions_visitor (visitor_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

// Consentimento mais recente de marketing por visitante; so entra quem concedeu.
// SSID do ultimo acesso como "estabelecimento".
const MARKETING_SQL = `SELECT v.id, v.full_name, v.email, v.phone, v.created_at, c.created_at AS consent_at,
    (SELECT s.ssid FROM wifi_sessions s WHERE s.visitor_id = v.id ORDER BY s.id DESC LIMIT 1) AS ssid
  FROM wifi_visitors v
  JOIN wifi_consents c ON c.visitor_id = v.id AND c.purpose = 'marketing'
    AND c.id = (SELECT MAX(c2.id) FROM wifi_consents c2 WHERE c2.visitor_id = v.id AND c2.purpose = 'marketing')
  WHERE c.granted = 1
  ORDER BY c.created_at DESC
  LIMIT ?`;

const LATEST_MARKETING_GRANTED_SQL = `SELECT c.id FROM wifi_consents c
  WHERE c.visitor_id = ? AND c.purpose = 'marketing' AND c.granted = 1
    AND c.id = (SELECT MAX(c2.id) FROM wifi_consents c2 WHERE c2.visitor_id = c.visitor_id AND c2.purpose = 'marketing')`;

interface SessionRow {
  id: number;
  visitor_id: string;
  username: string;
  password_hash: string;
  client_mac: string | null;
  status: string;
  expires_at: string;
}

interface MarketingRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
  consent_at: string;
  ssid: string | null;
}

function sessionFromRow(row: SessionRow): WifiSessionRecord {
  return {
    id: Number(row.id),
    visitorId: row.visitor_id,
    username: row.username,
    passwordHash: row.password_hash,
    clientMac: row.client_mac,
    status: row.status === "authorized" ? "authorized" : "pending",
    expiresAt: new Date(row.expires_at)
  };
}

function leadFromRow(row: MarketingRow): WifiMarketingLead {
  return {
    visitorId: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    establishment: row.ssid,
    registeredAt: row.created_at,
    marketingConsentAt: row.consent_at
  };
}

export class SqliteWifiRepository implements WifiRepository {
  private migrated = false;

  constructor(private readonly db: DatabaseSync) {}

  private ready() {
    if (!this.migrated) {
      this.db.exec(SQLITE_SCHEMA);
      this.migrated = true;
    }
  }

  async upsertVisitor(input: WifiVisitorInput, id: string): Promise<string> {
    this.ready();
    const now = iso(new Date());
    this.db
      .prepare(
        `INSERT INTO wifi_visitors (id, full_name, email, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (email, phone) DO UPDATE SET full_name = excluded.full_name, updated_at = excluded.updated_at`
      )
      .run(id, input.fullName, input.email, input.phone, now, now);
    const row = this.db.prepare("SELECT id FROM wifi_visitors WHERE email = ? AND phone = ?").get(input.email, input.phone) as
      | { id: string }
      | undefined;
    if (!row) throw new Error("wifi_visitors upsert failed");
    return row.id;
  }

  async recordConsent(visitorId: string, purpose: "terms" | "marketing", granted: boolean, version: string): Promise<void> {
    this.ready();
    this.db
      .prepare("INSERT INTO wifi_consents (visitor_id, purpose, granted, version, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(visitorId, purpose, granted ? 1 : 0, version, iso(new Date()));
  }

  async createSession(input: WifiSessionInput): Promise<void> {
    this.ready();
    this.db
      .prepare(
        `INSERT INTO wifi_sessions (visitor_id, username, password_hash, ap_mac, client_mac, ssid, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .run(input.visitorId, input.username, input.passwordHash, input.apMac, input.clientMac, input.ssid, iso(input.expiresAt), iso(new Date()));
  }

  async findSessionByUsername(username: string): Promise<WifiSessionRecord | null> {
    this.ready();
    const row = this.db.prepare("SELECT * FROM wifi_sessions WHERE username = ?").get(username) as SessionRow | undefined;
    return row ? sessionFromRow(row) : null;
  }

  async markAuthorized(id: number, when: Date): Promise<void> {
    this.ready();
    this.db
      .prepare("UPDATE wifi_sessions SET status = 'authorized', authorized_at = COALESCE(authorized_at, ?) WHERE id = ?")
      .run(iso(when), id);
  }

  async listMarketingLeads(limit: number): Promise<WifiMarketingLead[]> {
    this.ready();
    return (this.db.prepare(MARKETING_SQL).all(limit) as unknown as MarketingRow[]).map(leadFromRow);
  }

  async isMarketingLead(visitorId: string): Promise<boolean> {
    this.ready();
    return Boolean(this.db.prepare(LATEST_MARKETING_GRANTED_SQL).get(visitorId));
  }
}

export class MysqlWifiRepository implements WifiRepository {
  private migration: Promise<void> | undefined;

  constructor(private readonly pool: Pool) {}

  private ready() {
    this.migration ??= (async () => {
      for (const statement of MYSQL_SCHEMA) await this.pool.query(statement);
    })().catch((error) => {
      this.migration = undefined;
      throw error;
    });
    return this.migration;
  }

  async upsertVisitor(input: WifiVisitorInput, id: string): Promise<string> {
    await this.ready();
    const now = iso(new Date());
    await this.pool.execute(
      `INSERT INTO wifi_visitors (id, full_name, email, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), updated_at = VALUES(updated_at)`,
      [id, input.fullName, input.email, input.phone, now, now]
    );
    const [rows] = await this.pool.execute("SELECT id FROM wifi_visitors WHERE email = ? AND phone = ?", [input.email, input.phone]);
    const row = (rows as Array<{ id: string }>)[0];
    if (!row) throw new Error("wifi_visitors upsert failed");
    return row.id;
  }

  async recordConsent(visitorId: string, purpose: "terms" | "marketing", granted: boolean, version: string): Promise<void> {
    await this.ready();
    await this.pool.execute(
      "INSERT INTO wifi_consents (visitor_id, purpose, granted, version, created_at) VALUES (?, ?, ?, ?, ?)",
      [visitorId, purpose, granted ? 1 : 0, version, iso(new Date())]
    );
  }

  async createSession(input: WifiSessionInput): Promise<void> {
    await this.ready();
    await this.pool.execute(
      `INSERT INTO wifi_sessions (visitor_id, username, password_hash, ap_mac, client_mac, ssid, status, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [input.visitorId, input.username, input.passwordHash, input.apMac, input.clientMac, input.ssid, iso(input.expiresAt), iso(new Date())]
    );
  }

  async findSessionByUsername(username: string): Promise<WifiSessionRecord | null> {
    await this.ready();
    const [rows] = await this.pool.execute("SELECT * FROM wifi_sessions WHERE username = ?", [username]);
    const row = (rows as SessionRow[])[0];
    return row ? sessionFromRow(row) : null;
  }

  async markAuthorized(id: number, when: Date): Promise<void> {
    await this.ready();
    await this.pool.execute(
      "UPDATE wifi_sessions SET status = 'authorized', authorized_at = COALESCE(authorized_at, ?) WHERE id = ?",
      [iso(when), id]
    );
  }

  async listMarketingLeads(limit: number): Promise<WifiMarketingLead[]> {
    await this.ready();
    const [rows] = await this.pool.execute(MARKETING_SQL, [limit]);
    return (rows as MarketingRow[]).map(leadFromRow);
  }

  async isMarketingLead(visitorId: string): Promise<boolean> {
    await this.ready();
    const [rows] = await this.pool.execute(LATEST_MARKETING_GRANTED_SQL, [visitorId]);
    return (rows as unknown[]).length > 0;
  }
}
