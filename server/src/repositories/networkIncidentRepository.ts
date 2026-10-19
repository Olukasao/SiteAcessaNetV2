import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "mysql2/promise";
import { randomUUID } from "node:crypto";

export type NetworkIncidentStatus = "ACTIVE" | "RESOLVED";
export type NetworkIncidentMappingStatus = "OK" | "FAILED";

export interface NetworkIncidentRecord {
  id: string;
  externalAlertId: string;
  source: string;
  type: string;
  status: NetworkIncidentStatus;
  oltId: string | null;
  oltName: string | null;
  slot: string | null;
  pon: string | null;
  ponId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  affectedDevicesCount: number | null;
  totalDevicesCount: number | null;
  mappedContractsCount: number;
  unmappedEquipmentCount: number;
  mappingStatus: NetworkIncidentMappingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertNetworkIncidentInput {
  externalAlertId: string;
  oltId: string | null;
  oltName: string | null;
  slot: string | null;
  pon: string | null;
  ponId: string | null;
  startedAt: string | null;
  affectedDevicesCount: number | null;
  totalDevicesCount: number | null;
  mappedContractsCount: number;
  unmappedEquipmentCount: number;
  mappingStatus: NetworkIncidentMappingStatus;
  /** external_client_contract_id ja deduplicados (ver ponRosterService) -- substitui a associacao ativa anterior por completo. */
  contracts: string[];
}

/**
 * Persistencia de incidentes PON_OUTAGE (regra 16 do pedido de deteccao de
 * queda massiva) -- nunca duplica cadastro de cliente aqui (so contract_id,
 * ver regra 16 "nao duplicar informacoes cadastrais"). network_incidents ==
 * historico (nunca apagado, so status muda pra RESOLVED); a associacao
 * ATIVA com contratos (network_incident_contracts) e removida quando o
 * incidente resolve (regra 18).
 */
export interface NetworkIncidentRepository {
  /** Dedup por external_alert_id (regra 17): atualiza se existir, cria se nao. */
  upsertActive(input: UpsertNetworkIncidentInput): Promise<NetworkIncidentRecord>;
  /** Resolve (RESOLVED + ended_at) todo incidente ACTIVE cujo external_alert_id nao esteja na lista (ainda ativo segundo o ultimo sync). */
  resolveMissing(activeExternalAlertIds: string[]): Promise<void>;
  /** Consulta rapida local usada pela Central (regra 31) -- nunca chama a OLT Cloud na hora da requisicao do cliente. */
  findActiveByContract(contractId: string): Promise<NetworkIncidentRecord | null>;
  listActive(): Promise<NetworkIncidentRecord[]>;
  findById(id: string): Promise<NetworkIncidentRecord | null>;
  listContractsForIncident(incidentId: string): Promise<string[]>;
}

type SqlParam = string | number | null;

interface IncidentRow {
  id: string;
  external_alert_id: string;
  source: string;
  type: string;
  status: string;
  olt_id: string | null;
  olt_name: string | null;
  slot: string | null;
  pon: string | null;
  pon_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  affected_devices_count: number | null;
  total_devices_count: number | null;
  mapped_contracts_count: number;
  unmapped_equipment_count: number;
  mapping_status: string;
  created_at: string;
  updated_at: string;
}

function iso(value: Date) {
  return value.toISOString();
}

function fromRow(row: IncidentRow): NetworkIncidentRecord {
  return {
    id: row.id,
    externalAlertId: row.external_alert_id,
    source: row.source,
    type: row.type,
    status: row.status as NetworkIncidentStatus,
    oltId: row.olt_id,
    oltName: row.olt_name,
    slot: row.slot,
    pon: row.pon,
    ponId: row.pon_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    affectedDevicesCount: row.affected_devices_count === null ? null : Number(row.affected_devices_count),
    totalDevicesCount: row.total_devices_count === null ? null : Number(row.total_devices_count),
    mappedContractsCount: Number(row.mapped_contracts_count),
    unmappedEquipmentCount: Number(row.unmapped_equipment_count),
    mappingStatus: row.mapping_status as NetworkIncidentMappingStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function updateValues(input: UpsertNetworkIncidentInput, now: string): SqlParam[] {
  return [
    input.oltId,
    input.oltName,
    input.slot,
    input.pon,
    input.ponId,
    input.startedAt,
    input.affectedDevicesCount,
    input.totalDevicesCount,
    input.mappedContractsCount,
    input.unmappedEquipmentCount,
    input.mappingStatus,
    now
  ];
}

function insertValues(id: string, input: UpsertNetworkIncidentInput, now: string): SqlParam[] {
  return [
    id,
    input.externalAlertId,
    input.oltId,
    input.oltName,
    input.slot,
    input.pon,
    input.ponId,
    input.startedAt,
    input.affectedDevicesCount,
    input.totalDevicesCount,
    input.mappedContractsCount,
    input.unmappedEquipmentCount,
    input.mappingStatus,
    now,
    now
  ];
}

export class SqliteNetworkIncidentRepository implements NetworkIncidentRepository {
  constructor(private readonly db: DatabaseSync) {}

  async upsertActive(input: UpsertNetworkIncidentInput): Promise<NetworkIncidentRecord> {
    const now = iso(new Date());
    const existing = this.db
      .prepare("SELECT * FROM network_incidents WHERE external_alert_id = ?")
      .get(input.externalAlertId) as IncidentRow | undefined;

    const id = existing?.id ?? randomUUID();

    if (existing) {
      this.db
        .prepare(
          `UPDATE network_incidents SET
            status = 'ACTIVE', ended_at = NULL,
            olt_id = ?, olt_name = ?, slot = ?, pon = ?, pon_id = ?,
            started_at = COALESCE(started_at, ?),
            affected_devices_count = ?, total_devices_count = ?,
            mapped_contracts_count = ?, unmapped_equipment_count = ?, mapping_status = ?,
            updated_at = ?
           WHERE id = ?`
        )
        .run(...updateValues(input, now), id);
    } else {
      this.db
        .prepare(
          `INSERT INTO network_incidents
            (id, external_alert_id, source, type, status, olt_id, olt_name, slot, pon, pon_id, started_at, affected_devices_count, total_devices_count, mapped_contracts_count, unmapped_equipment_count, mapping_status, created_at, updated_at)
           VALUES (?, ?, 'OLT_CLOUD', 'PON_OUTAGE', 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(...insertValues(id, input, now));
    }

    this.db.prepare("DELETE FROM network_incident_contracts WHERE incident_id = ?").run(id);
    const insertContract = this.db.prepare("INSERT INTO network_incident_contracts (incident_id, contract_id) VALUES (?, ?)");
    for (const contractId of input.contracts) {
      insertContract.run(id, contractId);
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error("Failed to upsert network incident.");
    }
    return updated;
  }

  async resolveMissing(activeExternalAlertIds: string[]): Promise<void> {
    const now = iso(new Date());
    const rows = this.db
      .prepare("SELECT id, external_alert_id FROM network_incidents WHERE status = 'ACTIVE'")
      .all() as Array<{ id: string; external_alert_id: string }>;

    const activeSet = new Set(activeExternalAlertIds);
    for (const row of rows) {
      if (activeSet.has(row.external_alert_id)) continue;
      this.db.prepare("UPDATE network_incidents SET status = 'RESOLVED', ended_at = ? WHERE id = ?").run(now, row.id);
      this.db.prepare("DELETE FROM network_incident_contracts WHERE incident_id = ?").run(row.id);
    }
  }

  async findActiveByContract(contractId: string): Promise<NetworkIncidentRecord | null> {
    const row = this.db
      .prepare(
        `SELECT ni.* FROM network_incidents ni
         JOIN network_incident_contracts nic ON nic.incident_id = ni.id
         WHERE nic.contract_id = ? AND ni.status = 'ACTIVE'
         LIMIT 1`
      )
      .get(contractId) as IncidentRow | undefined;
    return row ? fromRow(row) : null;
  }

  async listActive(): Promise<NetworkIncidentRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM network_incidents WHERE status = 'ACTIVE' ORDER BY started_at DESC")
      .all() as unknown as IncidentRow[];
    return rows.map(fromRow);
  }

  async findById(id: string): Promise<NetworkIncidentRecord | null> {
    const row = this.db.prepare("SELECT * FROM network_incidents WHERE id = ?").get(id) as IncidentRow | undefined;
    return row ? fromRow(row) : null;
  }

  async listContractsForIncident(incidentId: string): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT contract_id FROM network_incident_contracts WHERE incident_id = ?")
      .all(incidentId) as unknown as Array<{ contract_id: string }>;
    return rows.map((row) => row.contract_id);
  }
}

export class MysqlNetworkIncidentRepository implements NetworkIncidentRepository {
  constructor(private readonly pool: Pool) {}

  async upsertActive(input: UpsertNetworkIncidentInput): Promise<NetworkIncidentRecord> {
    const now = iso(new Date());
    const [existingRows] = await this.pool.execute("SELECT * FROM network_incidents WHERE external_alert_id = ?", [
      input.externalAlertId
    ]);
    const existing = (existingRows as IncidentRow[])[0];
    const id = existing?.id ?? randomUUID();

    if (existing) {
      await this.pool.execute(
        `UPDATE network_incidents SET
          status = 'ACTIVE', ended_at = NULL,
          olt_id = ?, olt_name = ?, slot = ?, pon = ?, pon_id = ?,
          started_at = COALESCE(started_at, ?),
          affected_devices_count = ?, total_devices_count = ?,
          mapped_contracts_count = ?, unmapped_equipment_count = ?, mapping_status = ?,
          updated_at = ?
         WHERE id = ?`,
        [...updateValues(input, now), id]
      );
    } else {
      await this.pool.execute(
        `INSERT INTO network_incidents
          (id, external_alert_id, source, type, status, olt_id, olt_name, slot, pon, pon_id, started_at, affected_devices_count, total_devices_count, mapped_contracts_count, unmapped_equipment_count, mapping_status, created_at, updated_at)
         VALUES (?, ?, 'OLT_CLOUD', 'PON_OUTAGE', 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        insertValues(id, input, now)
      );
    }

    await this.pool.execute("DELETE FROM network_incident_contracts WHERE incident_id = ?", [id]);
    for (const contractId of input.contracts) {
      await this.pool.execute("INSERT INTO network_incident_contracts (incident_id, contract_id) VALUES (?, ?)", [id, contractId]);
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error("Failed to upsert network incident.");
    }
    return updated;
  }

  async resolveMissing(activeExternalAlertIds: string[]): Promise<void> {
    const now = iso(new Date());
    const [rows] = await this.pool.execute("SELECT id, external_alert_id FROM network_incidents WHERE status = 'ACTIVE'");
    const activeSet = new Set(activeExternalAlertIds);

    for (const row of rows as Array<{ id: string; external_alert_id: string }>) {
      if (activeSet.has(row.external_alert_id)) continue;
      await this.pool.execute("UPDATE network_incidents SET status = 'RESOLVED', ended_at = ? WHERE id = ?", [now, row.id]);
      await this.pool.execute("DELETE FROM network_incident_contracts WHERE incident_id = ?", [row.id]);
    }
  }

  async findActiveByContract(contractId: string): Promise<NetworkIncidentRecord | null> {
    const [rows] = await this.pool.execute(
      `SELECT ni.* FROM network_incidents ni
       JOIN network_incident_contracts nic ON nic.incident_id = ni.id
       WHERE nic.contract_id = ? AND ni.status = 'ACTIVE'
       LIMIT 1`,
      [contractId]
    );
    const row = (rows as IncidentRow[])[0];
    return row ? fromRow(row) : null;
  }

  async listActive(): Promise<NetworkIncidentRecord[]> {
    const [rows] = await this.pool.execute("SELECT * FROM network_incidents WHERE status = 'ACTIVE' ORDER BY started_at DESC");
    return (rows as IncidentRow[]).map(fromRow);
  }

  async findById(id: string): Promise<NetworkIncidentRecord | null> {
    const [rows] = await this.pool.execute("SELECT * FROM network_incidents WHERE id = ?", [id]);
    const row = (rows as IncidentRow[])[0];
    return row ? fromRow(row) : null;
  }

  async listContractsForIncident(incidentId: string): Promise<string[]> {
    const [rows] = await this.pool.execute("SELECT contract_id FROM network_incident_contracts WHERE incident_id = ?", [incidentId]);
    return (rows as Array<{ contract_id: string }>).map((row) => row.contract_id);
  }
}
