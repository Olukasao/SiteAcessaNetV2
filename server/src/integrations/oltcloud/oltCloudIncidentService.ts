import type { OltCloudClient } from "./oltCloudClient.js";
import { buildClientIncidentStatus, type ClientIncidentStatus } from "./clientIncidentStatus.js";

export interface ClientIdentifier {
  id?: string | undefined;
  pppoe?: string | undefined;
  document?: string | undefined;
  external_id?: string | undefined;
  external_contract_id?: string | undefined;
}

export type ClientIncidentResult =
  | ({ success: true; status: "ok" } & ClientIncidentStatus)
  | { success: false; status: "unknown"; affected: false };

/**
 * Cache em memoria por identificador de cliente (TTL curto, 30-60s por
 * padrao) -- existe so pra evitar que N clientes acessando a Central ao
 * mesmo tempo virem N chamadas simultaneas pra OLT Cloud. Se a OLT Cloud
 * falhar ou estourar o timeout, devolve status "unknown" em vez de derrubar
 * quem esta chamando -- a Central do Assinante precisa continuar
 * funcionando mesmo com a integracao fora do ar.
 */
export class OltCloudIncidentService {
  private readonly cache = new Map<string, { expiresAt: number; value: ClientIncidentResult }>();
  private readonly inFlight = new Map<string, Promise<ClientIncidentResult>>();

  constructor(
    private readonly client: OltCloudClient,
    private readonly cacheTtlMs: number
  ) {}

  async getClientIncidentStatus(identifier: ClientIdentifier): Promise<ClientIncidentResult> {
    const cacheKey = buildCacheKey(identifier);

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inFlight = this.inFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = this.fetchStatus(identifier).then((result) => {
      this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, value: result });
      return result;
    });

    this.inFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async fetchStatus(identifier: ClientIdentifier): Promise<ClientIncidentResult> {
    try {
      const raw = await this.client.getClientDeviceAlert(identifier);
      const status = buildClientIncidentStatus(raw);
      return { success: true, status: "ok", ...status };
    } catch {
      return { success: false, status: "unknown", affected: false };
    }
  }
}

function buildCacheKey(identifier: ClientIdentifier): string {
  return (
    identifier.external_contract_id ??
    identifier.pppoe ??
    identifier.id ??
    identifier.external_id ??
    identifier.document ??
    "unknown"
  );
}
