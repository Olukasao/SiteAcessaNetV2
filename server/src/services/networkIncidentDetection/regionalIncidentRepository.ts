import { randomId } from "../../security/hash.js";
import type { AlertCluster } from "./regionalIncidentClassifier.js";
import type { ClientNetworkTopology } from "./networkTopologyResolver.js";
import type { RegionalNetworkIncident } from "./types.js";

/**
 * Estado em memoria dos incidentes regionais -- mesma decisao de design que
 * o resto do backend ja usa pra dado derivado da OLT Cloud/SGP (InMemoryStore,
 * caches dos clients): nao precisa sobreviver a um restart, e recalculado a
 * cada refresh a partir da lista de alertas da OLT Cloud (+ eventuais probes
 * de equipment/list). SQLite fica reservado pra autenticacao (ver
 * repositories/sqlite.ts).
 *
 * Ciclo de vida (secao 12 do pedido) baseado em FRESCOR da evidencia, nao em
 * "sumiu de uma lista batch" -- assim duas fontes de evidencia independentes
 * (refresh periodico de alertas da OLT Cloud + probe de equipment/list por
 * cliente) podem alimentar o mesmo incidente sem uma derrubar o "lastEvidenceAt"
 * que a outra acabou de atualizar:
 *   fresco (evidencia recente)      -> confirmed/suspected
 *   sem evidencia ha > graceMs      -> recovering
 *   sem evidencia ha > grace+janela -> resolved
 * Confidence "low" nunca chega a virar incidente rastreado (upsertCluster
 * ignora) -- evita "aparece/some" por 1 cliente oscilando.
 */
export class RegionalIncidentRepository {
  private readonly incidents = new Map<string, RegionalNetworkIncident>();
  private dailySequence = { day: "", count: 0 };

  constructor(
    private readonly recoveryWindowMinutes: number,
    /** Tolerancia antes de considerar a evidencia "stale" -- deve cobrir pelo menos 1 ciclo normal de refresh. */
    private readonly evidenceGraceMs: number
  ) {}

  upsertCluster(cluster: AlertCluster, now = new Date()) {
    if (cluster.confidence === "low") {
      return;
    }

    const key = matchKeyForCluster(cluster);
    const existing = this.incidents.get(key);

    if (!existing || existing.status === "resolved") {
      this.incidents.set(key, this.createIncident(key, cluster, now));
      return;
    }

    const { recoveringSince: _dropped, ...existingWithoutRecovering } = existing;

    this.incidents.set(key, {
      ...existingWithoutRecovering,
      confidence: cluster.confidence,
      scope: cluster.scope,
      ...(cluster.olt ? { olt: cluster.olt } : {}),
      ...(cluster.pon ? { pon: cluster.pon } : {}),
      ctos: cluster.ctos.length > 0 ? cluster.ctos : existing.ctos,
      lastEvidenceAt: now.toISOString(),
      status: cluster.confidence === "medium" ? "suspected" : "confirmed",
      source: existing.source === cluster.source ? existing.source : "mixed",
      ...(cluster.affectedClientsEstimate !== undefined ? { affectedClientsEstimate: cluster.affectedClientsEstimate } : {})
    });
  }

  /** Reavalia status de todos os incidentes rastreados com base no frescor de lastEvidenceAt. Chamar antes de qualquer leitura. */
  sweepStale(now = new Date()) {
    for (const [key, incident] of this.incidents) {
      if (incident.status === "resolved") {
        continue;
      }

      const elapsedMs = now.getTime() - Date.parse(incident.lastEvidenceAt);

      if (elapsedMs <= this.evidenceGraceMs) {
        if (incident.status === "recovering") {
          const { recoveringSince: _dropped, ...rest } = incident;
          this.incidents.set(key, { ...rest, status: incident.confidence === "medium" ? "suspected" : "confirmed" });
        }
        continue;
      }

      const recoveryWindowMs = this.recoveryWindowMinutes * 60_000;
      if (elapsedMs <= this.evidenceGraceMs + recoveryWindowMs) {
        if (incident.status !== "recovering") {
          this.incidents.set(key, { ...incident, status: "recovering", recoveringSince: now.toISOString() });
        }
        continue;
      }

      this.incidents.set(key, { ...incident, status: "resolved", resolvedAt: now.toISOString() });
    }
  }

  /** Incidente ativo (suspected/confirmed/recovering) cuja topologia bate com a do cliente -- CTO exata tem prioridade, depois PON, depois OLT. */
  findActiveForTopology(topology: ClientNetworkTopology): RegionalNetworkIncident | undefined {
    const active = [...this.incidents.values()].filter((incident) => incident.status !== "resolved");

    if (topology.cto) {
      const byCto = active.find((incident) => incident.ctos?.includes(topology.cto!));
      if (byCto) return byCto;
    }

    if (topology.pon) {
      const byPon = active.find((incident) => incident.pon === topology.pon && (!incident.olt || !topology.olt || incident.olt === topology.olt));
      if (byPon) return byPon;
    }

    if (topology.olt) {
      const byOlt = active.find((incident) => incident.olt === topology.olt && incident.scope === "olt");
      if (byOlt) return byOlt;
    }

    return undefined;
  }

  listAll(): RegionalNetworkIncident[] {
    return [...this.incidents.values()].sort((a, b) => b.lastEvidenceAt.localeCompare(a.lastEvidenceAt));
  }

  private createIncident(key: string, cluster: AlertCluster, now: Date): RegionalNetworkIncident {
    return {
      id: randomId("regincident"),
      code: this.nextCode(now),
      status: cluster.confidence === "medium" ? "suspected" : "confirmed",
      confidence: cluster.confidence,
      scope: cluster.scope,
      ...(cluster.olt ? { olt: cluster.olt } : {}),
      ...(cluster.pon ? { pon: cluster.pon } : {}),
      ctos: cluster.ctos,
      startedAt: cluster.startedAt,
      lastEvidenceAt: now.toISOString(),
      source: cluster.source,
      ...(cluster.affectedClientsEstimate !== undefined ? { affectedClientsEstimate: cluster.affectedClientsEstimate } : {})
    };
  }

  private nextCode(now: Date): string {
    const day = now.toISOString().slice(0, 10).replace(/-/g, "");
    if (this.dailySequence.day !== day) {
      this.dailySequence = { day, count: 0 };
    }
    this.dailySequence.count += 1;
    return `INC-${day}-${String(this.dailySequence.count).padStart(3, "0")}`;
  }
}

function matchKeyForCluster(cluster: AlertCluster): string {
  if (cluster.scope === "olt" && cluster.olt) {
    return `olt:${cluster.olt}`;
  }
  if (cluster.pon) {
    return `pon:${cluster.pon}`;
  }
  if (cluster.ctos.length > 0) {
    return `cto:${cluster.ctos.slice().sort().join(",")}`;
  }
  return `olt:${cluster.olt ?? "unknown"}`;
}
