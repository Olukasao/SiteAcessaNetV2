/**
 * Dados reais disponiveis hoje (ver relatorio de inspecao no PR/commit que
 * introduziu este modulo):
 * - bairro/cidade: existem no SGP (endereco_bairro/bairro), mas so dentro de
 *   addressLine -- clientRegionResolver.ts extrai como campo proprio.
 * - latitude/longitude: NAO EXISTEM em lugar nenhum do backend hoje. Os
 *   campos ficam aqui e o resolver sempre devolve undefined -- Haversine so
 *   liga quando essa fonte de dado existir de verdade.
 * - olt/pon/cto: NAO vem do SGP. Só via OLT Cloud
 *   (client/device_alert?external_contract_id=), resolvido em
 *   networkTopologyResolver.ts.
 */
export interface ClientNetworkLocation {
  contractId: string;
  city?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  olt?: string;
  pon?: string;
  cto?: string;
}

export type IncidentConfidence = "low" | "medium" | "high" | "confirmed";

export type IncidentStatus = "suspected" | "confirmed" | "recovering" | "resolved";

export type IncidentScope = "cto" | "pon" | "olt" | "neighborhood" | "proximity";

export type IncidentSource = "oltcloud" | "correlation" | "mixed";

export interface RegionalNetworkIncident {
  id: string;
  /** Codigo legivel pra tela interna/logs, ex: INC-20260930-001. Nunca exposto ao cliente final. */
  code: string;
  status: IncidentStatus;
  confidence: IncidentConfidence;
  scope: IncidentScope;
  city?: string;
  neighborhood?: string;
  olt?: string;
  pon?: string;
  ctos: string[];
  startedAt: string;
  lastEvidenceAt: string;
  recoveringSince?: string;
  resolvedAt?: string;
  affectedClientsEstimate?: number;
  source: IncidentSource;
}

/** Evidencia bruta usada pra (re)classificar um incidente -- nunca exposta ao cliente final. */
export interface IncidentEvidence {
  scope: IncidentScope;
  olt?: string;
  pon?: string;
  cto?: string;
  occurredAt: string;
  /** true quando a evidencia vem de um alert_type conhecido da OLT Cloud (cto_loss/pon_loss/no_power). */
  officiallyConfirmed: boolean;
  affectedDevicesEstimate?: number;
}

/** O que a Central do Assinante pode ver -- nunca topologia, nunca contagem exata de clientes. */
export interface ClientRegionalIncidentStatus {
  affected: boolean;
  status: "normal" | "regional_incident" | "unknown";
  severity?: "info" | "warning";
  startedAt?: string;
  /** So preenchido internamente (uso do supportService/diagnostico) -- nunca serializado na resposta publica da rota. */
  confidence?: IncidentConfidence;
  incidentId?: string;
}
