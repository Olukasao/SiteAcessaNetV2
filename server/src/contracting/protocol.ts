import { randomInt } from "node:crypto";

/** Crockford base32 (sem I, L, O, U -- evita confusao ao ditar por telefone). */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** AAMMDD no fuso de Sao Paulo (data que o interessado ve no relogio). */
function datePart(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}`;
}

/** Protocolo `AC` + `AAMMDD` + `-` + 6 caracteres aleatorios (crypto.randomInt, nunca Math.random). Ex.: AC261017-7KQ3XD. */
export function generateContractProtocol(now: Date = new Date()) {
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += CROCKFORD[randomInt(0, CROCKFORD.length)];
  }
  return `AC${datePart(now)}-${suffix}`;
}

export const CONTRACT_PROTOCOL_PATTERN = /^AC\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/;
