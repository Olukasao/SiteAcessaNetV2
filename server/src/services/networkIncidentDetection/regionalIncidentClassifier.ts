import { isKnownAlertType, type NormalizedAlert } from "../../integrations/oltcloud/incidentClassifier.js";
import { isWithinRadius } from "./distance.js";
import type { IncidentConfidence, IncidentScope } from "./types.js";

export interface RegionalIncidentClassifierConfig {
  minClients: number;
  windowMinutes: number;
  radiusMeters: number;
}

export interface AlertCluster {
  scope: IncidentScope;
  olt?: string;
  pon?: string;
  ctos: string[];
  confidence: IncidentConfidence;
  source: "oltcloud" | "correlation";
  startedAt: string;
  lastEvidenceAt: string;
  affectedClientsEstimate?: number;
}

/**
 * Motor de evidencias sobre alertas JA ATIVOS da OLT Cloud (end_date null,
 * nao ignorados -- ver isActiveNetworkIncident, aplicado antes de chegar
 * aqui). Cada alerta ja representa um agrupamento de dispositivos por
 * OLT/PON/CTO -- por isso nao precisamos de um roster de clientes pra essa
 * parte: a OLT Cloud ja agrega isso em active_devices_count.
 *
 * Regra de confianca:
 * 1. alert_type conhecido (cto_loss/pon_loss/no_power) -- "confirmed",
 *    fonte "oltcloud". A classificacao oficial da OLT Cloud tem prioridade
 *    sobre qualquer inferencia nossa (nunca inventar incidente se a API ja
 *    fornece o evento).
 * 2. alert_type desconhecido mas active_devices_count >= minClients --
 *    "high", fonte "oltcloud" (ainda veio da API, so sem tipo oficial).
 * 3. active_devices_count entre 2 e minClients-1 -- "medium".
 * 4. active_devices_count <= 1 (ou ausente) -- "low" -- nao vira incidente
 *    regional sozinho (ver regionalIncidentService, que descarta "low").
 * 5. Multiplos alertas na MESMA OLT dentro da janela de tempo -- escala o
 *    escopo de "cto"/"pon" para "olt", combinando as CTOs envolvidas.
 */
export function classifyAlertClusters(
  alerts: NormalizedAlert[],
  config: RegionalIncidentClassifierConfig
): AlertCluster[] {
  const byKey = new Map<string, NormalizedAlert[]>();

  for (const alert of alerts) {
    const key = alert.ctoId || alert.ctoName ? `cto:${alert.ctoId || alert.ctoName}` : alert.ponId || alert.pon ? `pon:${alert.ponId || alert.pon}` : alert.oltId ? `olt:${alert.oltId}` : `unscoped:${alert.id}`;
    const group = byKey.get(key) ?? [];
    group.push(alert);
    byKey.set(key, group);
  }

  const clusters: AlertCluster[] = [];
  for (const group of byKey.values()) {
    clusters.push(classifyGroup(group, config));
  }

  return mergeSameOltWithinWindow(clusters, config);
}

function classifyGroup(alerts: NormalizedAlert[], config: RegionalIncidentClassifierConfig): AlertCluster {
  const primary = alerts[0]!;
  const scope: IncidentScope = primary.ctoId || primary.ctoName ? "cto" : primary.ponId || primary.pon ? "pon" : "olt";
  const officiallyConfirmed = alerts.some((alert) => isKnownAlertType(alert.alertType));
  const affectedClientsEstimate = alerts.reduce((sum, alert) => sum + (alert.activeDevicesCount ?? 0), 0) || undefined;

  const times = alerts.map((alert) => (alert.initialDate ? Date.parse(alert.initialDate) : Date.now())).filter(Number.isFinite);
  const startedAt = new Date(Math.min(...times)).toISOString();
  const lastEvidenceAt = new Date(Math.max(...times)).toISOString();

  let confidence: IncidentConfidence;
  if (officiallyConfirmed) {
    confidence = "confirmed";
  } else {
    confidence = confidenceFromCount(affectedClientsEstimate ?? 0, config.minClients);
  }

  return {
    scope,
    ...(primary.oltName || primary.oltId ? { olt: primary.oltName || primary.oltId } : {}),
    ...(primary.pon || primary.ponId ? { pon: primary.pon || primary.ponId } : {}),
    ctos: [...new Set(alerts.map((alert) => alert.ctoName || alert.ctoId).filter(Boolean))],
    confidence,
    source: "oltcloud",
    startedAt,
    lastEvidenceAt,
    ...(affectedClientsEstimate !== undefined ? { affectedClientsEstimate } : {})
  };
}

/** Varios clusters "cto"/"pon" distintos na mesma OLT, com evidencia dentro da janela de tempo, sao evidencia mais forte (escopo "olt") do que cada um isolado -- ver secao 4 do pedido. */
function mergeSameOltWithinWindow(clusters: AlertCluster[], config: RegionalIncidentClassifierConfig): AlertCluster[] {
  const byOlt = new Map<string, AlertCluster[]>();
  const withoutOlt: AlertCluster[] = [];

  for (const cluster of clusters) {
    if (!cluster.olt) {
      withoutOlt.push(cluster);
      continue;
    }
    const group = byOlt.get(cluster.olt) ?? [];
    group.push(cluster);
    byOlt.set(cluster.olt, group);
  }

  const merged: AlertCluster[] = [...withoutOlt];

  for (const [olt, group] of byOlt) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }

    const withinWindow = clustersWithinWindow(group, config.windowMinutes);
    if (!withinWindow) {
      merged.push(...group);
      continue;
    }

    const allCtos = [...new Set(group.flatMap((cluster) => cluster.ctos))];
    const totalAffected = group.reduce((sum, cluster) => sum + (cluster.affectedClientsEstimate ?? 0), 0) || undefined;
    const anyConfirmed = group.some((cluster) => cluster.confidence === "confirmed");
    const startedAt = new Date(Math.min(...group.map((cluster) => Date.parse(cluster.startedAt)))).toISOString();
    const lastEvidenceAt = new Date(Math.max(...group.map((cluster) => Date.parse(cluster.lastEvidenceAt)))).toISOString();

    merged.push({
      scope: "olt",
      olt,
      ctos: allCtos,
      confidence: anyConfirmed ? "confirmed" : confidenceFromCount(group.length, 2),
      source: anyConfirmed ? "oltcloud" : "correlation",
      startedAt,
      lastEvidenceAt,
      ...(totalAffected !== undefined ? { affectedClientsEstimate: totalAffected } : {})
    });
  }

  return merged;
}

function clustersWithinWindow(clusters: AlertCluster[], windowMinutes: number): boolean {
  const times = clusters.map((cluster) => Date.parse(cluster.startedAt)).filter(Number.isFinite);
  if (times.length < 2) {
    return false;
  }
  const spreadMs = Math.max(...times) - Math.min(...times);
  return spreadMs <= windowMinutes * 60_000;
}

function confidenceFromCount(count: number, minClients: number): IncidentConfidence {
  if (count >= minClients) {
    return "high";
  }
  if (count >= 2) {
    return "medium";
  }
  return "low";
}

export interface OfflinePoint {
  contractId: string;
  occurredAt: string;
  latitude: number;
  longitude: number;
}

/**
 * Clusteriza pontos offline por proximidade geografica + janela de tempo.
 * Pura/testavel -- HOJE NAO HA FONTE DE DADO REAL de latitude/longitude no
 * backend (ver clientRegionResolver.ts e types.ts), entao nenhum caminho de
 * producao chama esta funcao ainda. Existe pronta pra quando essa fonte
 * existir, sem quebrar nada.
 */
export function classifyProximityCluster(points: OfflinePoint[], config: RegionalIncidentClassifierConfig): number {
  let maxClusterSize = 0;

  for (const point of points) {
    const clusterSize = points.filter((other) => {
      const withinTime = Math.abs(Date.parse(other.occurredAt) - Date.parse(point.occurredAt)) <= config.windowMinutes * 60_000;
      if (!withinTime) return false;
      return isWithinRadius(point.latitude, point.longitude, other.latitude, other.longitude, config.radiusMeters);
    }).length;

    maxClusterSize = Math.max(maxClusterSize, clusterSize);
  }

  return maxClusterSize;
}

export { confidenceFromCount };
