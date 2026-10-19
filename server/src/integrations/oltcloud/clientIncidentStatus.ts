import { isActiveNetworkIncident, isKnownAlertType, normalizeAlert, type NormalizedAlert } from "./incidentClassifier.js";

export interface ClientIncidentStatus {
  affected: boolean;
  incidentType?: string;
  alertId?: string;
  olt?: string;
  pon?: string;
  cto?: string;
  startedAt?: string;
  affectedDevices?: number;
}

/**
 * A forma exata de GET /api/v2/client/device_alert nao esta 100% documentada
 * -- por isso a extracao abaixo e tolerante a variacoes de shape (lista de
 * alertas em "alerts"/"device_alerts"/"alerts_list", ou um unico alerta nos
 * campos de topo do objeto). Sempre prioriza o alerta mais recente que
 * passa em isActiveNetworkIncident; nunca inventa incidente se a API nao
 * devolveu nenhum alerta coletivo conhecido.
 */
export function buildClientIncidentStatus(raw: Record<string, unknown>): ClientIncidentStatus {
  const candidates = extractAlertCandidates(raw);

  const activeAlerts = candidates.map(normalizeAlert).filter(isActiveNetworkIncident);

  if (activeAlerts.length === 0) {
    return { affected: false };
  }

  const chosen = pickMostRelevant(activeAlerts);

  const status: ClientIncidentStatus = {
    affected: true,
    incidentType: chosen.alertType || "unknown"
  };

  if (chosen.id) status.alertId = chosen.id;
  if (chosen.oltName || chosen.oltId) status.olt = chosen.oltName || chosen.oltId;
  if (chosen.pon || chosen.ponId) status.pon = chosen.pon || chosen.ponId;
  if (chosen.ctoName || chosen.ctoId) status.cto = chosen.ctoName || chosen.ctoId;
  if (chosen.initialDate) status.startedAt = chosen.initialDate;
  if (chosen.activeDevicesCount !== null) status.affectedDevices = chosen.activeDevicesCount;

  return status;
}

function pickMostRelevant(alerts: NormalizedAlert[]): NormalizedAlert {
  const known = alerts.filter((alert) => isKnownAlertType(alert.alertType));
  const pool = known.length > 0 ? known : alerts;

  return pool.reduce((best, current) => {
    const bestTime = best.initialDate ? Date.parse(best.initialDate) : 0;
    const currentTime = current.initialDate ? Date.parse(current.initialDate) : 0;
    return currentTime > bestTime ? current : best;
  });
}

function extractAlertCandidates(raw: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["alerts", "device_alerts", "alerts_list", "data"]) {
    const value = raw[key];
    if (Array.isArray(value)) {
      return value as Record<string, unknown>[];
    }
  }

  if ("alert_type" in raw || "id" in raw) {
    return [raw];
  }

  return [];
}
