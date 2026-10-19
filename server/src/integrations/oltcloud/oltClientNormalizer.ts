import { maskDocument, normalizeDocument } from "../../auth/cpf.js";

export interface OltClientSummary {
  id: string | null;
  externalId: string | null;
  externalContractId: string | null;
  name: string | null;
  /** Documento SEMPRE mascarado -- mesma regra do resto do backend (ver auth/cpf.ts), nunca em texto puro numa resposta HTTP. */
  maskedDocument: string | null;
  pppoe: string | null;
  status: string | null;
  plan: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  contact: string | null;
  secondaryContact: string | null;
  coordinates: string | null;
  updatedAt: string | null;
}

/**
 * client/list da OLT Cloud devolve "pppoe_password" em TEXTO PURO (confirmado
 * ao vivo em 2026-10-07) -- esse campo NUNCA passa por este normalizador pro
 * resultado final, nem por engano: so os campos explicitamente listados
 * abaixo chegam ao objeto de saida. Documento sempre mascarado, mesma regra
 * de CPF/CNPJ usada no resto do backend (nunca em texto puro numa resposta
 * HTTP, mesmo pra admin interno).
 */
export function normalizeOltClient(raw: Record<string, unknown>): OltClientSummary {
  const document = pickString(raw, ["document"]);

  return {
    id: pickString(raw, ["id"]),
    externalId: pickString(raw, ["external_id"]),
    externalContractId: pickString(raw, ["external_contract_id"]),
    name: pickString(raw, ["client_name"]),
    maskedDocument: document && normalizeDocument(document) ? maskDocument(document) : null,
    pppoe: pickString(raw, ["pppoe"]),
    status: pickString(raw, ["status"]),
    plan: pickString(raw, ["plan"]),
    addressLine: pickString(raw, ["address"]),
    city: pickString(raw, ["city"]),
    state: pickString(raw, ["state"]),
    zipCode: pickString(raw, ["zip_code"]),
    contact: pickString(raw, ["contact"]),
    secondaryContact: pickString(raw, ["secondary_contact"]),
    coordinates: pickString(raw, ["coordinates"]),
    updatedAt: pickString(raw, ["updated_at"])
  };
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
