import type { OltCloudClient } from "../../integrations/oltcloud/oltCloudClient.js";
import { normalizeAlert, isActiveNetworkIncident, isPonOutageAlert, type NormalizedAlert } from "../../integrations/oltcloud/incidentClassifier.js";
import { getPonEquipment, buildPonRosterSummary } from "../../integrations/oltcloud/ponRosterService.js";

export interface PonOutageSnapshot {
  externalAlertId: string;
  oltId: string;
  oltName: string;
  slot: string;
  pon: string;
  ponId: string;
  startedAt: string | null;
  alertAffectedDevices: number | null;
  totalDevicesFromAlert: number | null;
  equipmentTotal: number;
  equipmentOffline: number;
  mappedContracts: number;
  unmappedEquipment: number;
  contracts: string[];
  /** FAILED = equipment/list falhou; o incidente ainda existe (fonte e o alert/list), so o mapeamento de contratos ficou pendente (ver regra 35). */
  mappingStatus: "OK" | "FAILED";
  /** So preenchido quando active_devices_count do alerta difere da contagem offline do equipment/list (ver regra 36) -- nunca descarta o incidente por isso. */
  countDivergence?: { alertReportedAffected: number; equipmentOfflineFound: number };
}

export type PonOutageLogEntry =
  | { event: "pon_outage_detected"; externalAlertId: string; oltId: string; slot: string; pon: string; affectedDevices: number | null }
  | {
      event: "pon_roster_resolved";
      externalAlertId: string;
      equipmentCount: number;
      offlineEquipment: number;
      mappedContracts: number;
      unmappedEquipment: number;
    }
  | { event: "pon_roster_mapping_failed"; externalAlertId: string; reason: string };

export type PonOutageLogger = (entry: PonOutageLogEntry) => void;

/**
 * Chave composta OLT+SLOT+PON (regra 7 do pedido) -- nunca agrupar so por
 * "pon", porque o mesmo numero de PON existe em OLTs diferentes.
 */
function ponGroupKey(alert: NormalizedAlert): string {
  return `${alert.oltId || alert.oltName}:${alert.slotPon}:${alert.ponId || alert.pon}`;
}

/**
 * Primeira etapa da deteccao de queda massiva de PON (ver secao 42 do
 * pedido): alert/list -> filtra pon_loss ativos -> agrupa por OLT+SLOT+PON
 * -> resolve o roster de equipamentos/contratos daquela PON via
 * equipment/list (ja paginado em oltCloudClient.listEquipment).
 *
 * Nao persiste nada ainda (sem banco), nao chama Central/Admin -- so prova
 * a cadeia alert/list -> equipment/list -> external_client_contract_id.
 * Integracao com RegionalIncidentService/banco/rotas publicas e etapa
 * seguinte, de proposito.
 */
export async function detectActivePonOutages(
  client: OltCloudClient,
  rawAlerts: Record<string, unknown>[],
  logger: PonOutageLogger = () => {}
): Promise<PonOutageSnapshot[]> {
  const activePonAlerts = rawAlerts.map(normalizeAlert).filter(isActiveNetworkIncident).filter(isPonOutageAlert);

  const groups = new Map<string, NormalizedAlert[]>();
  for (const alert of activePonAlerts) {
    const key = ponGroupKey(alert);
    const group = groups.get(key) ?? [];
    group.push(alert);
    groups.set(key, group);
  }

  const snapshots: PonOutageSnapshot[] = [];
  for (const group of groups.values()) {
    snapshots.push(await resolvePonOutageSnapshot(client, mostRecentAlert(group), logger));
  }

  return snapshots;
}

function mostRecentAlert(alerts: NormalizedAlert[]): NormalizedAlert {
  return alerts.reduce((best, current) => {
    const bestTime = best.initialDate ? Date.parse(best.initialDate) : 0;
    const currentTime = current.initialDate ? Date.parse(current.initialDate) : 0;
    return currentTime > bestTime ? current : best;
  });
}

async function resolvePonOutageSnapshot(
  client: OltCloudClient,
  alert: NormalizedAlert,
  logger: PonOutageLogger
): Promise<PonOutageSnapshot> {
  logger({
    event: "pon_outage_detected",
    externalAlertId: alert.id,
    oltId: alert.oltId,
    slot: alert.slotPon,
    pon: alert.pon || alert.ponId,
    affectedDevices: alert.activeDevicesCount
  });

  const base = {
    externalAlertId: alert.id,
    oltId: alert.oltId,
    oltName: alert.oltName,
    slot: alert.slotPon,
    pon: alert.pon,
    ponId: alert.ponId,
    startedAt: alert.initialDate,
    alertAffectedDevices: alert.activeDevicesCount,
    totalDevicesFromAlert: alert.totalDevicesCount
  };

  try {
    const equipment = await getPonEquipment(client, { oltId: alert.oltId, slot: alert.slotPon, pon: alert.pon, ponId: alert.ponId });
    const roster = buildPonRosterSummary(equipment);

    logger({
      event: "pon_roster_resolved",
      externalAlertId: alert.id,
      equipmentCount: roster.totalCount,
      offlineEquipment: roster.offlineCount,
      mappedContracts: roster.contracts.length,
      unmappedEquipment: roster.unmappedEquipmentCount
    });

    const countDivergence =
      alert.activeDevicesCount !== null && alert.activeDevicesCount !== roster.offlineCount
        ? { alertReportedAffected: alert.activeDevicesCount, equipmentOfflineFound: roster.offlineCount }
        : undefined;

    return {
      ...base,
      equipmentTotal: roster.totalCount,
      equipmentOffline: roster.offlineCount,
      mappedContracts: roster.contracts.length,
      unmappedEquipment: roster.unmappedEquipmentCount,
      contracts: roster.contracts,
      mappingStatus: "OK",
      ...(countDivergence ? { countDivergence } : {})
    };
  } catch (error) {
    logger({
      event: "pon_roster_mapping_failed",
      externalAlertId: alert.id,
      reason: error instanceof Error ? error.message : "unknown"
    });

    return {
      ...base,
      equipmentTotal: 0,
      equipmentOffline: 0,
      mappedContracts: 0,
      unmappedEquipment: 0,
      contracts: [],
      mappingStatus: "FAILED"
    };
  }
}
