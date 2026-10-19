export interface OltEquipment {
  serialNumber: string | null;
  status: string | null;
  lastStatusUpdate: string | null;
  lastDisconnection: string | null;
  clientId: string | null;
  clientPppoe: string | null;
  externalClientId: string | null;
  externalContractId: string | null;
  oltName: string | null;
  oltId: string | null;
  slot: string | null;
  pon: string | null;
  ponId: string | null;
  onuId: string | null;
}

/**
 * equipment/list ainda nao foi validado contra uma resposta real da OLT
 * Cloud neste projeto (so era consumido via equipment.length, ver
 * regionalIncidentService.ts) -- os nomes de campo abaixo sao exatamente os
 * documentados no pedido de deteccao de queda de PON, sem nenhum nome
 * alternativo inventado. Se o shape real divergir, so este normalizador
 * precisa mudar.
 */
export function normalizeEquipment(raw: Record<string, unknown>): OltEquipment {
  return {
    serialNumber: pickString(raw, ["serial_number"]),
    status: pickString(raw, ["status"]),
    lastStatusUpdate: pickString(raw, ["last_status_update"]),
    lastDisconnection: pickString(raw, ["last_disconnection"]),
    clientId: pickString(raw, ["client_id"]),
    clientPppoe: pickString(raw, ["client_pppoe"]),
    externalClientId: pickString(raw, ["external_client_id"]),
    externalContractId: pickString(raw, ["external_client_contract_id"]),
    oltName: pickString(raw, ["olt"]),
    oltId: pickString(raw, ["olt_id"]),
    slot: pickString(raw, ["slot"]),
    pon: pickString(raw, ["pon"]),
    ponId: pickString(raw, ["pon_id"]),
    onuId: pickString(raw, ["onu_id"])
  };
}

/**
 * Nao assume que todo equipamento retornado pelo filtro da PON esta
 * offline (ver regra 9 do pedido) -- so um "offline" explicito no campo
 * status conta. Valor exato do campo (case) nao confirmado contra uma
 * resposta real; comparacao case-insensitive ate confirmar.
 */
export function isEquipmentOffline(equipment: OltEquipment): boolean {
  return (equipment.status ?? "").trim().toLowerCase() === "offline";
}

function pickString(record: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}
