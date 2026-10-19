import type { OltCloudClient } from "../../integrations/oltcloud/oltCloudClient.js";
import { isActiveNetworkIncident, normalizeAlert } from "../../integrations/oltcloud/incidentClassifier.js";
import { classifyAlertClusters, confidenceFromCount, type RegionalIncidentClassifierConfig } from "./regionalIncidentClassifier.js";
import { RegionalIncidentRepository } from "./regionalIncidentRepository.js";
import { NetworkTopologyResolver } from "./networkTopologyResolver.js";
import type { ClientRegionalIncidentStatus, RegionalNetworkIncident } from "./types.js";

export interface RegionalIncidentServiceConfig extends RegionalIncidentClassifierConfig {
  recoveryWindowMinutes: number;
  refreshTtlMs: number;
  equipmentProbeTtlMs: number;
}

export interface RegionalIncidentLogEntry {
  event: "regional_incident_detected" | "oltcloud_refresh_failed";
  scope?: string;
  olt?: string;
  pon?: string;
  affectedEstimate?: number;
  confidence?: string;
  startedAt?: string;
}

export type RegionalIncidentLogger = (entry: RegionalIncidentLogEntry) => void;

/**
 * Orquestrador (secao 13 do pedido):
 *   OLT Cloud -> cache/backend -> correlacionador -> RegionalIncidentService -> Central
 * Nunca "browser -> OLT Cloud" -- so este servico fala com o client OLT Cloud.
 */
export class RegionalIncidentService {
  private readonly repository: RegionalIncidentRepository;
  private readonly topologyResolver: NetworkTopologyResolver;
  private readonly equipmentProbeCache = new Map<string, { expiresAt: number; count: number }>();
  private lastRefreshAt = 0;
  private lastRefreshOk = true;
  private refreshInFlight: Promise<void> | undefined;

  constructor(
    private readonly client: OltCloudClient,
    private readonly config: RegionalIncidentServiceConfig,
    private readonly logger: RegionalIncidentLogger = () => {}
  ) {
    /** Grace = 2x o TTL de refresh -- tolera 1 ciclo perdido antes de comecar a "recovering" de verdade. */
    this.repository = new RegionalIncidentRepository(config.recoveryWindowMinutes, config.refreshTtlMs * 2);
    this.topologyResolver = new NetworkTopologyResolver(client);
  }

  /** Nunca serializado ao cliente final -- so pra rota /admin/api. */
  listIncidents(): RegionalNetworkIncident[] {
    this.repository.sweepStale();
    return this.repository.listAll();
  }

  async getRegionalIncidentForClient(contractId: string): Promise<ClientRegionalIncidentStatus> {
    const refreshOk = await this.refreshIfStale();
    if (!refreshOk) {
      return { affected: false, status: "unknown" };
    }

    this.repository.sweepStale();

    const topology = await this.topologyResolver.resolve(contractId);

    let incident = this.repository.findActiveForTopology(topology);

    /**
     * Incidentes so alimentados pelo refresh periodico de alertas ("oltcloud")
     * ja ficam frescos sozinhos a cada doRefresh(). Incidentes "correlation"/
     * "mixed" dependem do probe de equipment/list pra continuar com
     * lastEvidenceAt atualizado -- sem isso eles "resolveriam" sozinhos
     * (por falta de evidencia nova) mesmo com o problema ainda ativo.
     */
    if ((!incident || incident.source !== "oltcloud") && (topology.olt || topology.pon)) {
      const probed = await this.probeEquipmentNeighbors(topology);
      if (probed) {
        incident = probed;
      }
    }

    if (!incident || (incident.status !== "confirmed" && incident.status !== "recovering")) {
      return { affected: false, status: "normal" };
    }

    return {
      affected: true,
      status: "regional_incident",
      severity: "warning",
      startedAt: incident.startedAt,
      confidence: incident.confidence,
      incidentId: incident.id
    };
  }

  private async refreshIfStale(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastRefreshAt < this.config.refreshTtlMs) {
      return this.lastRefreshOk;
    }

    if (this.refreshInFlight) {
      await this.refreshInFlight;
      return this.lastRefreshOk;
    }

    this.refreshInFlight = this.doRefresh();
    try {
      await this.refreshInFlight;
    } finally {
      this.refreshInFlight = undefined;
    }
    return this.lastRefreshOk;
  }

  private async doRefresh(): Promise<void> {
    try {
      const rawAlerts = await this.client.listAlerts();
      const activeAlerts = rawAlerts.map(normalizeAlert).filter(isActiveNetworkIncident);
      const clusters = classifyAlertClusters(activeAlerts, this.config);

      const now = new Date();
      for (const cluster of clusters) {
        this.repository.upsertCluster(cluster, now);
        if (cluster.confidence !== "low") {
          this.logger({
            event: "regional_incident_detected",
            scope: cluster.scope,
            ...(cluster.olt ? { olt: cluster.olt } : {}),
            ...(cluster.pon ? { pon: cluster.pon } : {}),
            ...(cluster.affectedClientsEstimate !== undefined ? { affectedEstimate: cluster.affectedClientsEstimate } : {}),
            confidence: cluster.confidence,
            startedAt: cluster.startedAt
          });
        }
      }

      this.lastRefreshAt = Date.now();
      this.lastRefreshOk = true;
    } catch {
      this.lastRefreshOk = false;
      this.lastRefreshAt = Date.now();
      this.logger({ event: "oltcloud_refresh_failed" });
    }
  }

  /**
   * Fallback quando a OLT Cloud ainda nao gerou um alerta oficial pra essa
   * CTO/PON, mas varios equipamentos da mesma PON do cliente ja estao
   * offline agora (equipment/list?status=offline). Cache por
   * olt+pon (equipmentProbeTtlMs) pra nao bater na OLT Cloud a cada cliente
   * que carrega a Central na mesma PON.
   */
  private async probeEquipmentNeighbors(topology: { olt?: string; pon?: string }): Promise<RegionalNetworkIncident | undefined> {
    if (!topology.pon) {
      return undefined;
    }

    const cacheKey = `${topology.olt ?? ""}:${topology.pon}`;
    const cached = this.equipmentProbeCache.get(cacheKey);
    const now = Date.now();

    let offlineCount: number;
    if (cached && cached.expiresAt > now) {
      offlineCount = cached.count;
    } else {
      try {
        const equipment = await this.client.listEquipment({
          olt_id: topology.olt,
          pon: topology.pon,
          status: "offline"
        });
        offlineCount = equipment.length;
        this.equipmentProbeCache.set(cacheKey, { expiresAt: now + this.config.equipmentProbeTtlMs, count: offlineCount });
      } catch {
        return undefined;
      }
    }

    const confidence = confidenceFromCount(offlineCount, this.config.minClients);
    if (confidence !== "high") {
      return undefined;
    }

    const nowDate = new Date(now);
    this.repository.upsertCluster(
      {
        scope: "pon",
        ...(topology.olt ? { olt: topology.olt } : {}),
        pon: topology.pon,
        ctos: [],
        confidence: "high",
        source: "correlation",
        startedAt: nowDate.toISOString(),
        lastEvidenceAt: nowDate.toISOString(),
        affectedClientsEstimate: offlineCount
      },
      nowDate
    );

    return this.repository.findActiveForTopology(topology);
  }
}
