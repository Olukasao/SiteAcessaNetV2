import type { OltCloudClient } from "./oltCloudClient.js";
import { isEquipmentOffline, normalizeEquipment } from "./oltEquipmentNormalizer.js";

export type OltConnectionStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

export interface OltClientConnection {
  status: OltConnectionStatus;
  lastStatusUpdate: string | null;
  deviceCount: number;
}

/**
 * equipment/list?external_client_contract_id=X faz match por SUBSTRING, nao
 * por igualdade -- confirmado ao vivo em 2026-10-07: filtrar pelo contrato
 * "5932" devolveu tambem um equipamento de OUTRO contrato ("35932", cliente
 * totalmente diferente), junto com o correto quando ele existia na mesma
 * pagina. NUNCA confiar no filtro da API sozinho -- sempre reconferir aqui
 * que externalContractId bate EXATAMENTE com o contrato pesquisado antes de
 * usar qualquer resultado (mesmo principio do resto do backend, ver
 * security/ownership.ts e integrations/sgp/sgpMapper.ts: um vazamento real
 * entre clientes ja aconteceu antes por confiar demais num filtro/id da API
 * sem reconferir igualdade exata).
 */
export async function getClientConnectionStatus(
  client: OltCloudClient,
  contractId: string
): Promise<OltClientConnection> {
  const raw = await client.listEquipment({ external_client_contract_id: contractId });
  const devices = raw.map(normalizeEquipment).filter((item) => item.externalContractId === contractId);

  if (devices.length === 0) {
    return { status: "UNKNOWN", lastStatusUpdate: null, deviceCount: 0 };
  }

  const anyOffline = devices.some(isEquipmentOffline);
  const lastStatusUpdate =
    devices
      .map((item) => item.lastStatusUpdate)
      .filter((value): value is string => Boolean(value))
      .sort()
      .pop() ?? null;

  return {
    status: anyOffline ? "OFFLINE" : "ONLINE",
    lastStatusUpdate,
    deviceCount: devices.length
  };
}
