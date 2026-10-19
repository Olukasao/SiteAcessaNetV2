import { randomInt } from "node:crypto";

/** Crockford base32 (sem I, L, O, U -- evita confusao ao ditar por telefone). */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Protocolo curto: `AC` + 6 caracteres aleatorios (crypto.randomInt, nunca Math.random). Ex.: AC7KQ3XD.
 * 32^6 (~1 bilhao) combinacoes; colisao cai no indice unico e o chamador gera outro.
 */
export function generateContractProtocol() {
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += CROCKFORD[randomInt(0, CROCKFORD.length)];
  }
  return `AC${suffix}`;
}

/** Aceita o formato curto e o antigo (`AC` + AAMMDD + `-` + 6), dos pedidos ja gravados. */
export const CONTRACT_PROTOCOL_PATTERN = /^AC(\d{6}-)?[0-9A-HJKMNP-TV-Z]{6}$/;
