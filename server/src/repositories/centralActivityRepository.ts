import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";

export type CentralActivityEvent =
  | "LOGIN"
  | "LOGOUT"
  | "VIEW_HOME"
  | "VIEW_CONTRACTS"
  | "SELECT_CONTRACT"
  | "VIEW_INVOICES"
  | "VIEW_BILLING"
  | "VIEW_PLAN"
  | "VIEW_CONNECTION"
  | "VIEW_TICKETS"
  | "VIEW_TICKET_DETAIL"
  | "OPEN_TICKET"
  | "REQUEST_PAYMENT_PROMISE"
  | "VIEW_NOTICES"
  | "VIEW_NETWORK_STATUS"
  | "VIEW_SIGNATURES"
  | "SIGNATURE_EVENT"
  | "CHANGE_PASSWORD"
  | "DOWNLOAD_INVOICE"
  | "GENERATE_PIX"
  | "CUSTOM";

export interface CentralActivitySessionInput {
  sessionId: string;
  customerId: string;
  cpfHash: string;
  cpfMasked?: string | null | undefined;
  customerName?: string | null | undefined;
  sgpCustomerId?: string | null | undefined;
  contractId?: string | null | undefined;
  ipHash?: string | null | undefined;
  userAgent?: string | null | undefined;
  deviceType?: string | null | undefined;
  when?: Date | undefined;
}

export interface CentralActivityLogInput extends CentralActivitySessionInput {
  eventType: CentralActivityEvent | string;
  page?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}

export interface AnalyticsRange {
  from: Date;
  to: Date;
}

export interface AnalyticsPoint {
  label: string;
  value: number;
}

export interface ActivityLogEntry {
  id: number;
  customerId: string;
  cpfHash: string | null;
  cpfMasked: string | null;
  customerName: string | null;
  sgpCustomerId: string | null;
  contractId: string | null;
  sessionId: string | null;
  eventType: string;
  page: string | null;
  metadata: Record<string, unknown> | null;
  ipHash: string | null;
  userAgent: string | null;
  deviceType: string | null;
  createdAt: Date;
}

export interface ActivityListResult {
  items: ActivityLogEntry[];
  page: number;
  limit: number;
  total: number;
}

export interface ClientAnalyticsRow {
  customerId: string;
  sgpCustomerId: string | null;
  customerName: string | null;
  cpfMasked: string | null;
  firstAccessAt: Date;
  lastAccessAt: Date;
  accessCount: number;
  sessionCount: number;
  lastActivity: string | null;
  contracts: string[];
}

export interface ClientListResult {
  items: ClientAnalyticsRow[];
  page: number;
  limit: number;
  total: number;
}

export interface OverviewAnalytics {
  range: {
    from: string;
    to: string;
  };
  totals: {
    accesses: number;
    uniqueClients: number;
    sessions: number;
    returningClients: number;
    newClients: number;
    averageSessionSeconds: number | null;
  };
  cards: {
    accessesToday: number;
    uniqueClientsToday: number;
    uniqueClients7d: number;
    uniqueClients30d: number;
    totalSessions: number;
    ticketsOpened: number;
    secondCopiesGenerated: number;
    invoiceQueries: number;
    connectionQueries: number;
  };
  charts: {
    accessesByDay: AnalyticsPoint[];
    accessesByHour: AnalyticsPoint[];
    uniqueClientsByDay: AnalyticsPoint[];
    events: AnalyticsPoint[];
    pages: AnalyticsPoint[];
    devices: AnalyticsPoint[];
  };
  recentActivity: ActivityLogEntry[];
}

export interface ActivityFilters {
  range: AnalyticsRange;
  page: number;
  limit: number;
  customer?: string | undefined;
  cpf?: string | undefined;
  contractId?: string | undefined;
  eventType?: string | undefined;
  pageName?: string | undefined;
  sgpCustomerId?: string | undefined;
  /** Busca livre: cliente, cpf mascarado, contrato, sgpCustomerId e dentro do JSON de metadata (ex.: protocolo, motivo). */
  search?: string | undefined;
  /** Igualdade exata (diferente de "customer", que faz LIKE em customer_id/customer_name) -- usado quando o customerId já foi resolvido com autoridade (ex.: histórico de chamados de um cliente especifico). */
  customerId?: string | undefined;
  /** Direção de ORDER BY created_at. Default "desc" quando omitido (mantém o comportamento existente). */
  order?: "asc" | "desc" | undefined;
}

const USER_AGENT_MAX_LENGTH = 500;
const NAME_MAX_LENGTH = 255;
const PAGE_MAX_LENGTH = 120;
const EVENT_MAX_LENGTH = 60;
type SqlParam = string | number | null;

function iso(value: Date) {
  return value.toISOString();
}

function clampText(value: string | null | undefined, length: number) {
  if (!value) return null;
  return value.slice(0, length);
}

function metadataToText(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  return JSON.stringify(redactMetadata(value));
}

function redactMetadata(value: Record<string, unknown>) {
  const blocked = /(password|senha|token|jwt|refresh|otp|codigo|c[oó]digo|cvv|cart[aã]o|card)/i;
  const output: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(value)) {
    if (blocked.test(key)) {
      continue;
    }

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      output[key] = redactMetadata(raw as Record<string, unknown>);
      continue;
    }

    if (typeof raw === "string") {
      output[key] = raw.slice(0, 500);
      continue;
    }

    output[key] = raw;
  }

  return output;
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface ActivityLogRow {
  id: number;
  customer_id: string;
  cpf_hash: string | null;
  cpf_masked: string | null;
  customer_name: string | null;
  sgp_customer_id: string | null;
  contract_id: string | null;
  session_id: string | null;
  event_type: string;
  page: string | null;
  metadata: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  device_type: string | null;
  created_at: string;
}

interface CountRow {
  value?: number | string | null;
  total?: number | string | null;
}

interface PointRow {
  label: string | null;
  value: number | string | null;
}

interface ClientRow {
  customer_id: string;
  sgp_customer_id: string | null;
  customer_name: string | null;
  cpf_masked: string | null;
  first_access_at: string;
  last_access_at: string;
  access_count: number | string;
  session_count: number | string;
  last_activity: string | null;
  contracts: string | null;
}

function activityFromRow(row: ActivityLogRow): ActivityLogEntry {
  return {
    id: Number(row.id),
    customerId: row.customer_id,
    cpfHash: row.cpf_hash,
    cpfMasked: row.cpf_masked,
    customerName: row.customer_name,
    sgpCustomerId: row.sgp_customer_id,
    contractId: row.contract_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    page: row.page,
    metadata: parseMetadata(row.metadata),
    ipHash: row.ip_hash,
    userAgent: row.user_agent,
    deviceType: row.device_type,
    createdAt: new Date(row.created_at)
  };
}

function clientFromRow(row: ClientRow): ClientAnalyticsRow {
  return {
    customerId: row.customer_id,
    sgpCustomerId: row.sgp_customer_id,
    customerName: row.customer_name,
    cpfMasked: row.cpf_masked,
    firstAccessAt: new Date(row.first_access_at),
    lastAccessAt: new Date(row.last_access_at),
    accessCount: Number(row.access_count ?? 0),
    sessionCount: Number(row.session_count ?? 0),
    lastActivity: row.last_activity,
    contracts: row.contracts ? row.contracts.split(",").filter(Boolean) : []
  };
}

function toPoints(rows: PointRow[]): AnalyticsPoint[] {
  return rows.map((row) => ({ label: row.label || "Não informado", value: Number(row.value ?? 0) }));
}

function countFromRow(row: CountRow | undefined) {
  return Number(row?.value ?? row?.total ?? 0);
}

function todayRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

function daysAgoRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to };
}

export interface CentralActivityRepository {
  upsertSession(input: CentralActivitySessionInput): Promise<void>;
  endSession(sessionId: string, when: Date): Promise<void>;
  record(input: CentralActivityLogInput): Promise<void>;
  overview(range: AnalyticsRange): Promise<OverviewAnalytics>;
  listActivity(filters: ActivityFilters): Promise<ActivityListResult>;
  listClients(filters: {
    range: AnalyticsRange;
    page: number;
    limit: number;
    search?: string | undefined;
    contractId?: string | undefined;
    eventType?: string | undefined;
  }): Promise<ClientListResult>;
  getClient(customerId: string, range: AnalyticsRange): Promise<(ClientAnalyticsRow & { recentActivity: ActivityLogEntry[] }) | null>;
  listEventTypes(): Promise<string[]>;
}

export class SqliteCentralActivityRepository implements CentralActivityRepository {
  constructor(private readonly db: DatabaseSync) {}

  async upsertSession(input: CentralActivitySessionInput): Promise<void> {
    const when = input.when ?? new Date();
    this.db
      .prepare(
        `INSERT INTO central_sessions
          (session_id, customer_id, cpf_hash, cpf_masked, customer_name, sgp_customer_id, first_contract_id, ip_hash, user_agent, device_type, started_at, last_activity_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
          last_activity_at = excluded.last_activity_at,
          customer_name = COALESCE(excluded.customer_name, central_sessions.customer_name),
          cpf_masked = COALESCE(excluded.cpf_masked, central_sessions.cpf_masked),
          sgp_customer_id = COALESCE(excluded.sgp_customer_id, central_sessions.sgp_customer_id),
          first_contract_id = COALESCE(central_sessions.first_contract_id, excluded.first_contract_id),
          user_agent = COALESCE(excluded.user_agent, central_sessions.user_agent),
          device_type = COALESCE(excluded.device_type, central_sessions.device_type)`
      )
      .run(
        input.sessionId,
        input.customerId,
        input.cpfHash,
        input.cpfMasked ?? null,
        clampText(input.customerName, NAME_MAX_LENGTH),
        input.sgpCustomerId ?? null,
        input.contractId ?? null,
        input.ipHash ?? null,
        clampText(input.userAgent, USER_AGENT_MAX_LENGTH),
        input.deviceType ?? null,
        iso(when),
        iso(when)
      );
  }

  async endSession(sessionId: string, when: Date): Promise<void> {
    this.db.prepare("UPDATE central_sessions SET ended_at = ?, last_activity_at = ? WHERE session_id = ?").run(
      iso(when),
      iso(when),
      sessionId
    );
  }

  async record(input: CentralActivityLogInput): Promise<void> {
    const when = input.when ?? new Date();
    await this.upsertSession(input);
    this.db
      .prepare(
        `INSERT INTO central_activity_logs
          (customer_id, cpf_hash, cpf_masked, customer_name, sgp_customer_id, contract_id, session_id, event_type, page, metadata, ip_hash, user_agent, device_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.customerId,
        input.cpfHash,
        input.cpfMasked ?? null,
        clampText(input.customerName, NAME_MAX_LENGTH),
        input.sgpCustomerId ?? null,
        input.contractId ?? null,
        input.sessionId,
        clampText(input.eventType, EVENT_MAX_LENGTH),
        clampText(input.page, PAGE_MAX_LENGTH),
        metadataToText(input.metadata),
        input.ipHash ?? null,
        clampText(input.userAgent, USER_AGENT_MAX_LENGTH),
        input.deviceType ?? null,
        iso(when)
      );
  }

  async overview(range: AnalyticsRange): Promise<OverviewAnalytics> {
    return buildOverview({
      range,
      count: (sql, params) => countFromRow(this.db.prepare(sql).get(...params) as CountRow | undefined),
      points: (sql, params) => toPoints(this.db.prepare(sql).all(...params) as unknown as PointRow[]),
      recent: (sql, params) => (this.db.prepare(sql).all(...params) as unknown as ActivityLogRow[]).map(activityFromRow),
      sql: sqliteSql
    });
  }

  async listActivity(filters: ActivityFilters): Promise<ActivityListResult> {
    const { where, params } = buildActivityWhere(filters, "sqlite");
    const offset = (filters.page - 1) * filters.limit;
    const direction = filters.order === "asc" ? "ASC" : "DESC";
    const total = countFromRow(
      this.db.prepare(`SELECT COUNT(*) AS value FROM central_activity_logs ${where}`).get(...params) as CountRow | undefined
    );
    const rows = this.db
      .prepare(`SELECT * FROM central_activity_logs ${where} ORDER BY created_at ${direction} LIMIT ? OFFSET ?`)
      .all(...params, filters.limit, offset) as unknown as ActivityLogRow[];

    return { items: rows.map(activityFromRow), page: filters.page, limit: filters.limit, total };
  }

  async listClients(filters: {
    range: AnalyticsRange;
    page: number;
    limit: number;
    search?: string | undefined;
    contractId?: string | undefined;
    eventType?: string | undefined;
  }): Promise<ClientListResult> {
    const built = buildClientWhere(filters, "sqlite");
    const offset = (filters.page - 1) * filters.limit;
    const total = countFromRow(
      this.db
        .prepare(`SELECT COUNT(*) AS value FROM (SELECT customer_id FROM central_activity_logs ${built.where} GROUP BY customer_id) t`)
        .get(...built.params) as CountRow | undefined
    );
    const rows = this.db
      .prepare(
        `${sqliteClientSelect} ${built.where}
         GROUP BY customer_id
         ORDER BY MAX(created_at) DESC
         LIMIT ? OFFSET ?`
      )
      .all(...built.params, filters.limit, offset) as unknown as ClientRow[];

    return { items: rows.map(clientFromRow), page: filters.page, limit: filters.limit, total };
  }

  async getClient(customerId: string, range: AnalyticsRange): Promise<(ClientAnalyticsRow & { recentActivity: ActivityLogEntry[] }) | null> {
    const params = [iso(range.from), iso(range.to), customerId];
    const row = this.db
      .prepare(`${sqliteClientSelect} WHERE created_at >= ? AND created_at < ? AND customer_id = ? GROUP BY customer_id`)
      .get(...params) as ClientRow | undefined;

    if (!row) return null;

    const recentRows = this.db
      .prepare("SELECT * FROM central_activity_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(customerId) as unknown as ActivityLogRow[];

    return { ...clientFromRow(row), recentActivity: recentRows.map(activityFromRow) };
  }

  async listEventTypes(): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT DISTINCT event_type AS label FROM central_activity_logs ORDER BY event_type ASC")
      .all() as Array<{ label: string }>;
    return rows.map((row) => row.label);
  }
}

export class MysqlCentralActivityRepository implements CentralActivityRepository {
  constructor(private readonly pool: Pool) {}

  async upsertSession(input: CentralActivitySessionInput): Promise<void> {
    const when = input.when ?? new Date();
    await this.pool.execute(
      `INSERT INTO central_sessions
        (session_id, customer_id, cpf_hash, cpf_masked, customer_name, sgp_customer_id, first_contract_id, ip_hash, user_agent, device_type, started_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        last_activity_at = VALUES(last_activity_at),
        customer_name = COALESCE(VALUES(customer_name), customer_name),
        cpf_masked = COALESCE(VALUES(cpf_masked), cpf_masked),
        sgp_customer_id = COALESCE(VALUES(sgp_customer_id), sgp_customer_id),
        first_contract_id = COALESCE(first_contract_id, VALUES(first_contract_id)),
        user_agent = COALESCE(VALUES(user_agent), user_agent),
        device_type = COALESCE(VALUES(device_type), device_type)`,
      [
        input.sessionId,
        input.customerId,
        input.cpfHash,
        input.cpfMasked ?? null,
        clampText(input.customerName, NAME_MAX_LENGTH),
        input.sgpCustomerId ?? null,
        input.contractId ?? null,
        input.ipHash ?? null,
        clampText(input.userAgent, USER_AGENT_MAX_LENGTH),
        input.deviceType ?? null,
        iso(when),
        iso(when)
      ]
    );
  }

  async endSession(sessionId: string, when: Date): Promise<void> {
    await this.pool.execute("UPDATE central_sessions SET ended_at = ?, last_activity_at = ? WHERE session_id = ?", [
      iso(when),
      iso(when),
      sessionId
    ]);
  }

  async record(input: CentralActivityLogInput): Promise<void> {
    const when = input.when ?? new Date();
    await this.upsertSession(input);
    await this.pool.execute(
      `INSERT INTO central_activity_logs
        (customer_id, cpf_hash, cpf_masked, customer_name, sgp_customer_id, contract_id, session_id, event_type, page, metadata, ip_hash, user_agent, device_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.customerId,
        input.cpfHash,
        input.cpfMasked ?? null,
        clampText(input.customerName, NAME_MAX_LENGTH),
        input.sgpCustomerId ?? null,
        input.contractId ?? null,
        input.sessionId,
        clampText(input.eventType, EVENT_MAX_LENGTH),
        clampText(input.page, PAGE_MAX_LENGTH),
        metadataToText(input.metadata),
        input.ipHash ?? null,
        clampText(input.userAgent, USER_AGENT_MAX_LENGTH),
        input.deviceType ?? null,
        iso(when)
      ]
    );
  }

  async overview(range: AnalyticsRange): Promise<OverviewAnalytics> {
    return buildOverview({
      range,
      count: async (sql, params) => {
        const [rows] = await this.pool.execute(sql, params);
        return countFromRow((rows as CountRow[])[0]);
      },
      points: async (sql, params) => {
        const [rows] = await this.pool.execute(sql, params);
        return toPoints(rows as PointRow[]);
      },
      recent: async (sql, params) => {
        const [rows] = await this.pool.execute(sql, params);
        return (rows as ActivityLogRow[]).map(activityFromRow);
      },
      sql: mysqlSql
    });
  }

  async listActivity(filters: ActivityFilters): Promise<ActivityListResult> {
    const { where, params } = buildActivityWhere(filters, "mysql");
    const offset = (filters.page - 1) * filters.limit;
    const direction = filters.order === "asc" ? "ASC" : "DESC";
    const [countRows] = await this.pool.execute(`SELECT COUNT(*) AS value FROM central_activity_logs ${where}`, params);
    const [rows] = await this.pool.execute(
      `SELECT * FROM central_activity_logs ${where} ORDER BY created_at ${direction} LIMIT ? OFFSET ?`,
      [...params, filters.limit, offset]
    );

    return {
      items: (rows as ActivityLogRow[]).map(activityFromRow),
      page: filters.page,
      limit: filters.limit,
      total: countFromRow((countRows as CountRow[])[0])
    };
  }

  async listClients(filters: {
    range: AnalyticsRange;
    page: number;
    limit: number;
    search?: string | undefined;
    contractId?: string | undefined;
    eventType?: string | undefined;
  }): Promise<ClientListResult> {
    const built = buildClientWhere(filters, "mysql");
    const offset = (filters.page - 1) * filters.limit;
    const [countRows] = await this.pool.execute(
      `SELECT COUNT(*) AS value FROM (SELECT customer_id FROM central_activity_logs ${built.where} GROUP BY customer_id) t`,
      built.params
    );
    const [rows] = await this.pool.execute(
      `${mysqlClientSelect} ${built.where}
       GROUP BY customer_id
       ORDER BY MAX(created_at) DESC
       LIMIT ? OFFSET ?`,
      [...built.params, filters.limit, offset]
    );

    return {
      items: (rows as ClientRow[]).map(clientFromRow),
      page: filters.page,
      limit: filters.limit,
      total: countFromRow((countRows as CountRow[])[0])
    };
  }

  async getClient(customerId: string, range: AnalyticsRange): Promise<(ClientAnalyticsRow & { recentActivity: ActivityLogEntry[] }) | null> {
    const params = [iso(range.from), iso(range.to), customerId];
    const [clientRows] = await this.pool.execute(
      `${mysqlClientSelect} WHERE created_at >= ? AND created_at < ? AND customer_id = ? GROUP BY customer_id`,
      params
    );
    const row = (clientRows as ClientRow[])[0];
    if (!row) return null;

    const [recentRows] = await this.pool.execute(
      "SELECT * FROM central_activity_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100",
      [customerId]
    );

    return { ...clientFromRow(row), recentActivity: (recentRows as ActivityLogRow[]).map(activityFromRow) };
  }

  async listEventTypes(): Promise<string[]> {
    const [rows] = await this.pool.execute("SELECT DISTINCT event_type AS label FROM central_activity_logs ORDER BY event_type ASC");
    return (rows as Array<{ label: string }>).map((row) => row.label);
  }
}

const sqliteClientSelect = `
  SELECT
    customer_id,
    COALESCE(MAX(sgp_customer_id), '') AS sgp_customer_id,
    COALESCE(MAX(customer_name), '') AS customer_name,
    COALESCE(MAX(cpf_masked), '') AS cpf_masked,
    MIN(created_at) AS first_access_at,
    MAX(created_at) AS last_access_at,
    COUNT(*) AS access_count,
    COUNT(DISTINCT session_id) AS session_count,
    (SELECT event_type FROM central_activity_logs latest WHERE latest.customer_id = central_activity_logs.customer_id ORDER BY created_at DESC LIMIT 1) AS last_activity,
    GROUP_CONCAT(DISTINCT contract_id) AS contracts
  FROM central_activity_logs`;

const mysqlClientSelect = `
  SELECT
    customer_id,
    COALESCE(MAX(sgp_customer_id), '') AS sgp_customer_id,
    COALESCE(MAX(customer_name), '') AS customer_name,
    COALESCE(MAX(cpf_masked), '') AS cpf_masked,
    MIN(created_at) AS first_access_at,
    MAX(created_at) AS last_access_at,
    COUNT(*) AS access_count,
    COUNT(DISTINCT session_id) AS session_count,
    (SELECT event_type FROM central_activity_logs latest WHERE latest.customer_id = central_activity_logs.customer_id ORDER BY created_at DESC LIMIT 1) AS last_activity,
    GROUP_CONCAT(DISTINCT contract_id) AS contracts
  FROM central_activity_logs`;

const sqliteSql = {
  day: "substr(created_at, 1, 10)",
  hour: "substr(created_at, 12, 2)",
  sessionDuration:
    "AVG(CASE WHEN ended_at IS NOT NULL THEN strftime('%s', ended_at) - strftime('%s', started_at) ELSE NULL END)"
};

const mysqlSql = {
  day: "SUBSTRING(created_at, 1, 10)",
  hour: "SUBSTRING(created_at, 12, 2)",
  sessionDuration:
    "AVG(CASE WHEN ended_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, CAST(started_at AS DATETIME), CAST(ended_at AS DATETIME)) ELSE NULL END)"
};

async function buildOverview(input: {
  range: AnalyticsRange;
  count: (sql: string, params: SqlParam[]) => number | Promise<number>;
  points: (sql: string, params: SqlParam[]) => AnalyticsPoint[] | Promise<AnalyticsPoint[]>;
  recent: (sql: string, params: SqlParam[]) => ActivityLogEntry[] | Promise<ActivityLogEntry[]>;
  sql: typeof sqliteSql;
}): Promise<OverviewAnalytics> {
  const rangeParams: SqlParam[] = [iso(input.range.from), iso(input.range.to)];
  const today = todayRange();
  const last7 = daysAgoRange(7);
  const last30 = daysAgoRange(30);

  const [
    accesses,
    uniqueClients,
    sessions,
    returningClients,
    newClients,
    averageSessionSeconds,
    accessesToday,
    uniqueClientsToday,
    uniqueClients7d,
    uniqueClients30d,
    totalSessions,
    ticketsOpened,
    secondCopiesGenerated,
    invoiceQueries,
    connectionQueries,
    accessesByDay,
    accessesByHour,
    uniqueClientsByDay,
    events,
    pages,
    devices,
    recentActivity
  ] = await Promise.all([
    input.count("SELECT COUNT(*) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ?", rangeParams),
    input.count("SELECT COUNT(DISTINCT customer_id) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ?", rangeParams),
    input.count("SELECT COUNT(*) AS value FROM central_sessions WHERE started_at >= ? AND started_at < ?", rangeParams),
    input.count(
      `SELECT COUNT(*) AS value FROM (
        SELECT customer_id, COUNT(DISTINCT session_id) AS sessions_count
        FROM central_activity_logs
        WHERE created_at >= ? AND created_at < ?
        GROUP BY customer_id
        HAVING sessions_count > 1
      ) t`,
      rangeParams
    ),
    input.count(
      `SELECT COUNT(*) AS value FROM (
        SELECT customer_id, MIN(created_at) AS first_seen
        FROM central_activity_logs
        GROUP BY customer_id
        HAVING first_seen >= ? AND first_seen < ?
      ) t`,
      rangeParams
    ),
    input.count(`SELECT ${input.sql.sessionDuration} AS value FROM central_sessions WHERE started_at >= ? AND started_at < ?`, rangeParams),
    input.count("SELECT COUNT(*) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ?", [
      iso(today.from),
      iso(today.to)
    ]),
    input.count("SELECT COUNT(DISTINCT customer_id) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ?", [
      iso(today.from),
      iso(today.to)
    ]),
    input.count("SELECT COUNT(DISTINCT customer_id) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ?", [
      iso(last7.from),
      iso(last7.to)
    ]),
    input.count("SELECT COUNT(DISTINCT customer_id) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ?", [
      iso(last30.from),
      iso(last30.to)
    ]),
    input.count("SELECT COUNT(*) AS value FROM central_sessions", []),
    input.count("SELECT COUNT(*) AS value FROM central_activity_logs WHERE event_type = 'OPEN_TICKET' AND created_at >= ? AND created_at < ?", rangeParams),
    input.count("SELECT COUNT(*) AS value FROM central_activity_logs WHERE event_type = 'DOWNLOAD_INVOICE' AND created_at >= ? AND created_at < ?", rangeParams),
    input.count(
      "SELECT COUNT(*) AS value FROM central_activity_logs WHERE event_type IN ('VIEW_INVOICES', 'VIEW_BILLING', 'GENERATE_PIX') AND created_at >= ? AND created_at < ?",
      rangeParams
    ),
    input.count("SELECT COUNT(*) AS value FROM central_activity_logs WHERE event_type = 'VIEW_CONNECTION' AND created_at >= ? AND created_at < ?", rangeParams),
    input.points(
      `SELECT ${input.sql.day} AS label, COUNT(*) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ? GROUP BY label ORDER BY label ASC`,
      rangeParams
    ),
    input.points(
      `SELECT ${input.sql.hour} AS label, COUNT(*) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ? GROUP BY label ORDER BY label ASC`,
      rangeParams
    ),
    input.points(
      `SELECT ${input.sql.day} AS label, COUNT(DISTINCT customer_id) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ? GROUP BY label ORDER BY label ASC`,
      rangeParams
    ),
    input.points(
      "SELECT event_type AS label, COUNT(*) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ? GROUP BY event_type ORDER BY value DESC LIMIT 12",
      rangeParams
    ),
    input.points(
      "SELECT page AS label, COUNT(*) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ? GROUP BY page ORDER BY value DESC LIMIT 12",
      rangeParams
    ),
    input.points(
      "SELECT device_type AS label, COUNT(*) AS value FROM central_activity_logs WHERE created_at >= ? AND created_at < ? GROUP BY device_type ORDER BY value DESC",
      rangeParams
    ),
    input.recent(
      "SELECT * FROM central_activity_logs WHERE event_type IN ('LOGIN', 'OPEN_TICKET') AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 12",
      rangeParams
    )
  ]);

  return {
    range: { from: iso(input.range.from), to: iso(input.range.to) },
    totals: {
      accesses,
      uniqueClients,
      sessions,
      returningClients,
      newClients,
      averageSessionSeconds: Number.isFinite(averageSessionSeconds) && averageSessionSeconds > 0 ? Math.round(averageSessionSeconds) : null
    },
    cards: {
      accessesToday,
      uniqueClientsToday,
      uniqueClients7d,
      uniqueClients30d,
      totalSessions,
      ticketsOpened,
      secondCopiesGenerated,
      invoiceQueries,
      connectionQueries
    },
    charts: { accessesByDay, accessesByHour, uniqueClientsByDay, events, pages, devices },
    recentActivity
  };
}

function buildActivityWhere(filters: ActivityFilters, driver: "sqlite" | "mysql") {
  const clauses = ["created_at >= ?", "created_at < ?"];
  const params: SqlParam[] = [iso(filters.range.from), iso(filters.range.to)];

  if (filters.customer) {
    clauses.push("(customer_id LIKE ? OR customer_name LIKE ?)");
    params.push(`%${filters.customer}%`, `%${filters.customer}%`);
  }
  if (filters.cpf) {
    clauses.push("(cpf_masked LIKE ? OR cpf_hash LIKE ?)");
    params.push(`%${filters.cpf}%`, `%${filters.cpf}%`);
  }
  if (filters.contractId) {
    clauses.push("contract_id = ?");
    params.push(filters.contractId);
  }
  if (filters.eventType) {
    clauses.push("event_type = ?");
    params.push(filters.eventType);
  }
  if (filters.pageName) {
    clauses.push("page = ?");
    params.push(filters.pageName);
  }
  if (filters.sgpCustomerId) {
    clauses.push("sgp_customer_id = ?");
    params.push(filters.sgpCustomerId);
  }
  if (filters.search) {
    clauses.push(
      "(customer_id LIKE ? OR customer_name LIKE ? OR cpf_masked LIKE ? OR contract_id LIKE ? OR sgp_customer_id LIKE ? OR metadata LIKE ?)"
    );
    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like, like);
  }
  if (filters.customerId) {
    clauses.push("customer_id = ?");
    params.push(filters.customerId);
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, params, driver };
}

function buildClientWhere(
  filters: {
    range: AnalyticsRange;
    search?: string | undefined;
    contractId?: string | undefined;
    eventType?: string | undefined;
  },
  driver: "sqlite" | "mysql"
) {
  const clauses = ["created_at >= ?", "created_at < ?"];
  const params: SqlParam[] = [iso(filters.range.from), iso(filters.range.to)];

  if (filters.search) {
    clauses.push("(customer_id LIKE ? OR customer_name LIKE ? OR cpf_masked LIKE ? OR sgp_customer_id LIKE ? OR contract_id LIKE ?)");
    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like);
  }
  if (filters.contractId) {
    clauses.push("contract_id = ?");
    params.push(filters.contractId);
  }
  if (filters.eventType) {
    clauses.push("event_type = ?");
    params.push(filters.eventType);
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, params, driver };
}
