import type { OltCloudClient } from "../../integrations/oltcloud/oltCloudClient.js";
import { normalizeAlert } from "../../integrations/oltcloud/incidentClassifier.js";

export interface ClientNetworkTopology {
  olt?: string;
  pon?: string;
  cto?: string;
}

/**
 * Resolve a posicao do cliente na rede (OLT/PON/CTO) via
 * GET /api/v2/client/device_alert?external_contract_id=. O shape exato de
 * campos de topologia no nivel raiz da resposta nao esta 100% documentado
 * (so os campos de alerta estao, ver spec original) -- por isso tenta
 * varios nomes plausiveis no nivel raiz e, se nao achar, cai pros campos do
 * alerta mais recente devolvido junto (um alerta tambem informa OLT/PON/CTO
 * de onde o cliente esta).
 *
 * IMPORTANTE: isso so resolve a topologia de UM contrato ja conhecido --
 * nunca usar pra varrer clientes em massa (a OLT Cloud nao expõe um
 * "roster" de todos os clientes por OLT/PON/CTO, so por alerta ou por
 * equipment/list com filtro explicito).
 */
export class NetworkTopologyResolver {
  constructor(private readonly client: OltCloudClient) {}

  async resolve(contractId: string): Promise<ClientNetworkTopology> {
    let raw: Record<string, unknown>;
    try {
      raw = await this.client.getClientDeviceAlert({ external_contract_id: contractId });
    } catch {
      return {};
    }

    const topLevel = {
      olt: pickString(raw, ["olt", "olt_name", "oltName", "client_olt", "clientOlt"]),
      pon: pickString(raw, ["pon", "client_pon", "clientPon"]),
      cto: pickString(raw, ["cto", "cto_name", "ctoName", "client_cto", "clientCto"])
    };

    if (topLevel.olt || topLevel.pon || topLevel.cto) {
      return withoutEmpty(topLevel);
    }

    const alerts = extractAlertCandidates(raw);
    if (alerts.length === 0) {
      return {};
    }

    const normalized = normalizeAlert(alerts[0] as Record<string, unknown>);
    return withoutEmpty({
      olt: normalized.oltName || normalized.oltId,
      pon: normalized.pon || normalized.ponId,
      cto: normalized.ctoName || normalized.ctoId
    });
  }
}

function extractAlertCandidates(raw: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["alerts", "device_alerts", "alerts_list", "data"]) {
    if (Array.isArray(raw[key])) {
      return raw[key] as Record<string, unknown>[];
    }
  }
  if ("alert_type" in raw || "id" in raw) {
    return [raw];
  }
  return [];
}

function pickString(record: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function withoutEmpty(topology: ClientNetworkTopology): ClientNetworkTopology {
  const result: ClientNetworkTopology = {};
  if (topology.olt) result.olt = topology.olt;
  if (topology.pon) result.pon = topology.pon;
  if (topology.cto) result.cto = topology.cto;
  return result;
}
