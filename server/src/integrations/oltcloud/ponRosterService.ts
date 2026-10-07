import type { OltCloudClient } from "./oltCloudClient.js";
import { normalizeEquipment, isEquipmentOffline, type OltEquipment } from "./oltEquipmentNormalizer.js";

export interface PonIdentifier {
  oltId?: string | undefined;
  slot?: string | undefined;
  pon?: string | undefined;
  ponId?: string | undefined;
}

export interface PonRosterSummary {
  equipment: OltEquipment[];
  totalCount: number;
  offlineCount: number;
  /** external_client_contract_id unicos (deduplicados) dos equipamentos OFFLINE -- nunca de todos os equipamentos da PON (ver regra 9). */
  contracts: string[];
  /** Equipamentos offline sem external_client_contract_id valido -- nao impede a criacao do incidente, so fica sem associar esse cliente. */
  unmappedEquipmentCount: number;
}

/**
 * Busca todos os equipamentos de uma PON (chave composta -- nunca so
 * "pon=X", porque o mesmo numero de PON existe em OLTs diferentes, ver
 * regra 7 do pedido). Preferencia: olt_id + slot + pon. Fallback: olt_id +
 * pon_id, usado quando o alerta nao trouxe slot_pon preenchido.
 */
export async function getPonEquipment(client: OltCloudClient, identifier: PonIdentifier): Promise<OltEquipment[]> {
  const filters = identifier.slot
    ? { olt_id: identifier.oltId, slot: identifier.slot, pon: identifier.pon }
    : { olt_id: identifier.oltId, pon_id: identifier.ponId ?? identifier.pon };

  const raw = await client.listEquipment(filters);
  return raw.map(normalizeEquipment);
}

/** Dedup (regra 37) + descarta null/undefined/vazio (regra 8). */
export function getPonAffectedContracts(equipment: OltEquipment[]): string[] {
  const seen = new Set<string>();
  for (const item of equipment) {
    if (item.externalContractId) {
      seen.add(item.externalContractId);
    }
  }
  return [...seen];
}

export function buildPonRosterSummary(equipment: OltEquipment[]): PonRosterSummary {
  const offline = equipment.filter(isEquipmentOffline);
  const offlineWithContract = offline.filter((item) => item.externalContractId);

  return {
    equipment,
    totalCount: equipment.length,
    offlineCount: offline.length,
    contracts: getPonAffectedContracts(offlineWithContract),
    unmappedEquipmentCount: offline.length - offlineWithContract.length
  };
}
