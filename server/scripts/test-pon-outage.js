#!/usr/bin/env node
/**
 * Script INDEPENDENTE de validacao da cadeia alert/list -> equipment/list
 * -> external_client_contract_id pra deteccao de queda massiva de PON
 * (somente leitura). Nao depende do backend TS -- roda direto com `node`,
 * igual test-oltcloud.js.
 *
 * Uso:
 *   node scripts/test-pon-outage.js <oltId> <slot> <pon>
 *
 * Variaveis de ambiente usadas (ver server/.env):
 *   OLTCLOUD_BASE_URL, OLTCLOUD_TOKEN, OLTCLOUD_TIMEOUT_MS
 *
 * So faz GET em alert/list e equipment/list. Nunca chama endpoint de
 * escrita.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(scriptDir, "..");

dotenv.config();
dotenv.config({ path: path.join(serverRoot, ".env") });

const BASE_URL = (process.env.OLTCLOUD_BASE_URL ?? "").trim().replace(/\/+$/, "");
const TOKEN = (process.env.OLTCLOUD_TOKEN ?? "").trim();
const TIMEOUT_MS = Number(process.env.OLTCLOUD_TIMEOUT_MS ?? 8000);

const [OLT_ID, SLOT, PON] = process.argv.slice(2);

const EQUIPMENT_PAGE_SIZE = 1000;
const MAX_PAGES = 500;

const requestLog = [];

async function oltCloudGet(url, logLabel) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const result = { url: logLabel, durationMs: 0, status: null, ok: false, data: null, error: null };

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });

    result.status = response.status;
    result.ok = response.ok;

    if (response.ok) {
      try {
        result.data = await response.json();
      } catch {
        result.error = "RESPOSTA_INVALIDA_JSON";
      }
    } else if (response.status === 401) {
      result.error = "401 - token invalido ou expirado";
    } else if (response.status === 403) {
      result.error = "403 - usuario sem permissao para este recurso";
    } else if (response.status >= 500) {
      result.error = `${response.status} - erro na API da OLT Cloud`;
    } else {
      result.error = `${response.status} - requisicao rejeitada`;
    }
  } catch (error) {
    result.error = error?.name === "AbortError" ? `timeout apos ${TIMEOUT_MS}ms` : `falha de rede: ${error.message}`;
  } finally {
    clearTimeout(timer);
    result.durationMs = Date.now() - startedAt;
    requestLog.push({ url: logLabel, status: result.status, ok: result.ok, durationMs: result.durationMs });
  }

  return result;
}

function normalizeList(response, listKeys) {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object") {
    for (const key of listKeys) {
      if (Array.isArray(response[key])) return response[key];
    }
  }
  return [];
}

function extractNext(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return undefined;
  const next = response.next;
  if (typeof next === "string" && next.trim()) return next.trim();
  if (typeof next === "number" && Number.isFinite(next)) return next;
  return undefined;
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

function resolveNextUrl(next) {
  if (/^https?:\/\//i.test(next)) return next;
  const path = next.startsWith("/") ? next : `/${next}`;
  return `${BASE_URL}${path}`;
}

/** equipment/list pode ser paginado -- junta todas as paginas antes de considerar a lista completa (regra 6 do pedido). */
async function fetchAllEquipment(filters) {
  const all = [];
  let nextUrl;
  let page = 1;
  let pagesFetched = 0;

  for (let i = 0; i < MAX_PAGES; i++) {
    const url = nextUrl
      ? resolveNextUrl(nextUrl)
      : `${BASE_URL}/api/v2/ftth/equipment/list?${buildQuery({ ...filters, page_size: EQUIPMENT_PAGE_SIZE, page: page > 1 ? page : undefined })}`;

    const result = await oltCloudGet(url, `equipment/list (pagina ${pagesFetched + 1})`);
    pagesFetched++;

    if (!result.ok) {
      return { ok: false, error: result.error, equipment: all, pagesFetched };
    }

    all.push(...normalizeList(result.data, ["data", "equipment", "items", "results"]));

    const next = extractNext(result.data);
    if (next === undefined) break;
    if (typeof next === "string") {
      nextUrl = next;
      page++;
    } else {
      if (next === page) break;
      page = next;
      nextUrl = undefined;
    }
  }

  return { ok: true, equipment: all, pagesFetched };
}

function normalizeEquipment(raw) {
  const pickString = (fields) => {
    for (const field of fields) {
      const value = raw[field];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return null;
  };

  return {
    serialNumber: pickString(["serial_number"]),
    status: pickString(["status"]),
    lastStatusUpdate: pickString(["last_status_update"]),
    lastDisconnection: pickString(["last_disconnection"]),
    externalContractId: pickString(["external_client_contract_id"]),
    externalClientId: pickString(["external_client_id"])
  };
}

function isOffline(equipment) {
  return (equipment.status ?? "").trim().toLowerCase() === "offline";
}

function maskSerial(serial) {
  if (!serial) return "(sem serial)";
  if (serial.length <= 4) return "*".repeat(serial.length);
  return `${"*".repeat(serial.length - 4)}${serial.slice(-4)}`;
}

function line(char = "-", length = 30) {
  console.log(char.repeat(length));
}

async function main() {
  console.log("=== TESTE: deteccao de queda de PON (alert/list -> equipment/list) ===\n");

  const missing = [];
  if (!BASE_URL) missing.push("OLTCLOUD_BASE_URL");
  if (!TOKEN) missing.push("OLTCLOUD_TOKEN");
  if (missing.length > 0) {
    console.log(`Faltando no .env: ${missing.join(", ")}`);
    console.log("Preencha server/.env com as credenciais reais da OLT Cloud e rode de novo.");
    process.exitCode = 1;
    return;
  }

  if (!OLT_ID || !SLOT || !PON) {
    console.log("Uso: node scripts/test-pon-outage.js <oltId> <slot> <pon>\n");
    console.log("Exemplo: node scripts/test-pon-outage.js 14 1 3");
    process.exitCode = 1;
    return;
  }

  console.log(`OLT: ${OLT_ID}`);
  console.log(`SLOT: ${SLOT}`);
  console.log(`PON: ${PON}\n`);

  line();
  console.log("\nBuscando equipamentos da PON (equipment/list, com paginacao)...\n");

  const { ok, error, equipment: rawEquipment, pagesFetched } = await fetchAllEquipment({
    olt_id: OLT_ID,
    slot: SLOT,
    pon: PON
  });

  if (!ok) {
    console.log(`FALHOU ao buscar equipment/list: ${error}`);
    console.log(`Paginas obtidas antes da falha: ${pagesFetched}`);
    console.log("\nIsso NAO deveria descartar um incidente PON_OUTAGE ja confirmado por alert/list (ver regra 35) -- so o mapeamento de contratos ficaria pendente.");
    process.exitCode = 1;
    return;
  }

  const equipment = rawEquipment.map(normalizeEquipment);
  const offline = equipment.filter(isOffline);
  const offlineWithContract = offline.filter((item) => item.externalContractId);
  const contracts = [...new Set(offlineWithContract.map((item) => item.externalContractId))];
  const unmapped = offline.length - offlineWithContract.length;

  console.log("RELATORIO\n");
  console.log(`Paginas buscadas: ${pagesFetched}`);
  console.log(`Total de equipamentos na PON: ${equipment.length}`);
  console.log(`Equipamentos offline: ${offline.length}`);
  console.log(`Equipamentos online/outro status: ${equipment.length - offline.length}`);
  console.log(`Contratos mapeados (dedup): ${contracts.length}`);
  console.log(`Equipamentos offline sem external_client_contract_id: ${unmapped}`);
  console.log("");

  console.log(`Primeiros contratos encontrados (max 10): ${contracts.slice(0, 10).join(", ") || "(nenhum)"}`);
  console.log("");

  console.log("Amostra de equipamentos offline (serial mascarado, max 5):");
  for (const item of offline.slice(0, 5)) {
    console.log(`  serial=${maskSerial(item.serialNumber)} contrato=${item.externalContractId ?? "(sem contrato)"} status=${item.status}`);
  }
  console.log("");

  const avgDurationMs = requestLog.length > 0 ? Math.round(requestLog.reduce((sum, r) => sum + r.durationMs, 0) / requestLog.length) : null;
  console.log(`Tempo medio das chamadas: ${avgDurationMs !== null ? `${avgDurationMs}ms (${requestLog.length} chamadas)` : "n/a"}`);

  line();
  console.log("\nLimitacoes:");
  console.log("  - Shape exato de equipment/list (nomes de campo, forma da paginacao) nao foi validado contra uma resposta real neste ambiente.");
  console.log("  - Valor exato da string de status 'offline' nao confirmado -- comparacao feita case-insensitive.");
}

main().catch((error) => {
  console.error("Erro inesperado no script de teste:", error);
  process.exitCode = 1;
});
