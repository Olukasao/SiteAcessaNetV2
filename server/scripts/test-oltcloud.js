#!/usr/bin/env node
/**
 * Script INDEPENDENTE de validacao da integracao OLT Cloud (somente
 * leitura). Nao depende do backend TS -- roda direto com `node`.
 *
 * Uso:
 *   node scripts/test-oltcloud.js [contractId]
 *
 * Variaveis de ambiente usadas (ver server/.env):
 *   OLTCLOUD_BASE_URL, OLTCLOUD_TOKEN, OLTCLOUD_TIMEOUT_MS,
 *   OLTCLOUD_TEST_CONTRACT_ID (usado se [contractId] nao for passado)
 *
 * So faz GET. Nunca chama confirm/ignore/reactivate nem qualquer endpoint
 * de escrita.
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
const CONTRACT_ID = (process.argv[2] ?? process.env.OLTCLOUD_TEST_CONTRACT_ID ?? "").trim();

const KNOWN_ALERT_TYPES = ["cto_loss", "pon_loss", "no_power"];

const requestLog = [];

async function oltCloudGet(endpointPath) {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const result = { path: endpointPath, timestamp, durationMs: 0, status: null, ok: false, data: null, error: null };

  try {
    const response = await fetch(`${BASE_URL}${endpointPath}`, {
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
    requestLog.push({ path: endpointPath, status: result.status, ok: result.ok, durationMs: result.durationMs });
  }

  return result;
}

function normalizeAlert(raw) {
  const pickString = (fields) => {
    for (const field of fields) {
      const value = raw[field];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return "";
  };
  const pickNumber = (field) => {
    const value = raw[field];
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const pickBool = (field) => raw[field] === true || raw[field] === "true" || raw[field] === 1 || raw[field] === "1";

  return {
    id: pickString(["id"]),
    alertType: pickString(["alert_type"]),
    oltId: pickString(["olt_id"]),
    oltName: pickString(["olt_name"]),
    initialDate: pickString(["initial_date"]) || null,
    confirmDate: pickString(["confirm_date"]) || null,
    endDate: pickString(["end_date"]) || null,
    ignored: pickBool("ignored"),
    description: pickString(["description"]),
    totalDevicesCount: pickNumber("total_devices_count"),
    activeDevicesCount: pickNumber("active_devices_count"),
    ponId: pickString(["pon_id"]),
    pon: pickString(["pon"]),
    slotPon: pickString(["slot_pon"]),
    ctoId: pickString(["cto_id"]),
    ctoName: pickString(["cto_name"])
  };
}

/**
 * Mesmos criterios documentados em
 * server/src/integrations/oltcloud/incidentClassifier.ts -- manter os dois
 * em sincronia se o criterio mudar.
 */
function isActiveNetworkIncident(alert) {
  if (alert.endDate) return false;
  if (alert.ignored) return false;
  if (alert.activeDevicesCount !== null && alert.activeDevicesCount <= 0) return false;
  return true;
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

function extractAlertCandidates(raw) {
  for (const key of ["alerts", "device_alerts", "alerts_list", "data"]) {
    if (Array.isArray(raw?.[key])) return raw[key];
  }
  if (raw && (("alert_type" in raw) || ("id" in raw))) return [raw];
  return [];
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function line(char = "-", length = 26) {
  console.log(char.repeat(length));
}

async function main() {
  console.log("=== OLT CLOUD TEST ===\n");

  const missing = [];
  if (!BASE_URL) missing.push("OLTCLOUD_BASE_URL");
  if (!TOKEN) missing.push("OLTCLOUD_TOKEN");

  if (missing.length > 0) {
    console.log("API:");
    console.log("FALHOU (configuracao ausente)\n");
    console.log(`Faltando no .env: ${missing.join(", ")}`);
    console.log("Preencha server/.env com as credenciais reais da OLT Cloud e rode de novo.");
    process.exitCode = 1;
    return;
  }

  // TESTE 1: autenticacao / API acessivel
  const alertListResult = await oltCloudGet("/api/v2/ftth/alert/list");

  console.log("API:");
  if (alertListResult.ok) {
    console.log("OK\n");
  } else {
    console.log(`FALHOU (${alertListResult.error})\n`);
    console.log("Nao foi possivel validar os proximos testes sem autenticacao funcionando.");
    printFinalReport({ authOk: false });
    process.exitCode = 1;
    return;
  }

  const rawAlerts = normalizeList(alertListResult.data, ["data", "alerts", "items", "results"]);
  const alerts = rawAlerts.map(normalizeAlert);

  // TESTE 2: alertas ativos
  const activeAlerts = alerts.filter(isActiveNetworkIncident);
  console.log("Alertas ativos:");
  console.log(String(activeAlerts.length));
  console.log("");

  // TESTE 3: agrupar por tipo
  const byType = {};
  for (const alert of activeAlerts) {
    const key = alert.alertType || "unknown";
    byType[key] = (byType[key] ?? 0) + 1;
  }
  const unknownTypesSeen = [...new Set(alerts.map((a) => a.alertType).filter((t) => t && !KNOWN_ALERT_TYPES.includes(t)))];

  console.log("CTO LOSS:");
  console.log(String(byType["cto_loss"] ?? 0));
  console.log("");
  console.log("PON LOSS:");
  console.log(String(byType["pon_loss"] ?? 0));
  console.log("");
  console.log("NO POWER:");
  console.log(String(byType["no_power"] ?? 0));
  console.log("");
  if (unknownTypesSeen.length > 0) {
    console.log("Outros alert_type encontrados (sem regra propria ainda):");
    console.log(unknownTypesSeen.join(", "));
    console.log("");
  }

  line();
  console.log("");
  console.log("CLIENTE TESTADO\n");

  if (!CONTRACT_ID) {
    console.log("Contrato:");
    console.log("(nenhum informado)\n");
    console.log("Passe um contrato para testar TESTE 4/5/6:");
    console.log("  node scripts/test-oltcloud.js <contractId>");
    console.log("  ou preencha OLTCLOUD_TEST_CONTRACT_ID no .env\n");
    line();
    printFinalReport({ authOk: true, alerts, activeAlerts, byType, unknownTypesSeen, clientTested: false });
    return;
  }

  console.log("Contrato:");
  console.log(CONTRACT_ID);
  console.log("");

  // TESTE 4: consultar cliente por external_contract_id
  const clientResult = await oltCloudGet(`/api/v2/client/device_alert?external_contract_id=${encodeURIComponent(CONTRACT_ID)}`);

  const found = clientResult.ok && clientResult.data && Object.keys(clientResult.data).length > 0;
  console.log("Encontrado:");
  console.log(found ? "SIM" : clientResult.ok ? "NAO" : `ERRO (${clientResult.error})`);
  console.log("");

  let chosenAlert = null;
  if (found) {
    const candidates = extractAlertCandidates(clientResult.data).map(normalizeAlert);
    const activeCandidates = candidates.filter(isActiveNetworkIncident);
    if (activeCandidates.length > 0) {
      const known = activeCandidates.filter((a) => KNOWN_ALERT_TYPES.includes(a.alertType));
      const pool = known.length > 0 ? known : activeCandidates;
      chosenAlert = pool.reduce((best, current) => {
        const bestTime = best.initialDate ? Date.parse(best.initialDate) : 0;
        const currentTime = current.initialDate ? Date.parse(current.initialDate) : 0;
        return currentTime > bestTime ? current : best;
      });
    }
  }

  // TESTE 6: OLT/PON/CTO do cliente (independente de haver incidente ativo)
  const clientTopLevel = found ? clientResult.data : {};
  const oltFromResponse = chosenAlert?.oltName || chosenAlert?.oltId || clientTopLevel.olt_name || clientTopLevel.olt || "";
  const ponFromResponse = chosenAlert?.pon || chosenAlert?.ponId || clientTopLevel.pon || "";
  const ctoFromResponse = chosenAlert?.ctoName || chosenAlert?.ctoId || clientTopLevel.cto_name || clientTopLevel.cto || "";

  console.log("OLT:");
  console.log(oltFromResponse || "(nao informado pela API)");
  console.log("");
  console.log("PON:");
  console.log(ponFromResponse || "(nao informado pela API)");
  console.log("");
  console.log("CTO:");
  console.log(ctoFromResponse || "(nao informado pela API)");
  console.log("");

  // TESTE 5: cliente esta dentro de algum incidente?
  console.log("INCIDENTE:");
  console.log(chosenAlert ? "SIM" : "NAO");
  console.log("");
  if (chosenAlert) {
    console.log("Tipo:");
    console.log(chosenAlert.alertType.toUpperCase().replace(/_/g, " ") || "(desconhecido)");
    console.log("");
    console.log("ONUs afetadas:");
    console.log(chosenAlert.activeDevicesCount ?? "(nao informado)");
    console.log("");
    console.log("Inicio:");
    console.log(formatDate(chosenAlert.initialDate));
    console.log("");
  }

  line();
  console.log("");

  printFinalReport({
    authOk: true,
    alerts,
    activeAlerts,
    byType,
    unknownTypesSeen,
    clientTested: true,
    clientFound: found,
    chosenAlert,
    oltFromResponse,
    ponFromResponse,
    ctoFromResponse
  });
}

function printFinalReport(ctx) {
  const avgDurationMs =
    requestLog.length > 0 ? Math.round(requestLog.reduce((sum, r) => sum + r.durationMs, 0) / requestLog.length) : null;

  console.log("=== RELATORIO ===\n");
  console.log(`1. A autenticacao funcionou? ${ctx.authOk ? "SIM" : "NAO"}`);
  console.log(`2. Base URL utilizada: ${BASE_URL || "(nao configurada)"}`);

  if (!ctx.authOk) {
    console.log("\nDemais perguntas nao puderam ser verificadas -- autenticacao falhou.");
    console.log(`\nChamadas realizadas: ${requestLog.length}`);
    return;
  }

  const typesFound = [...new Set(ctx.alerts.map((a) => a.alertType).filter(Boolean))];
  console.log(`3. Tipos de alerta encontrados: ${typesFound.length > 0 ? typesFound.join(", ") : "(nenhum alerta retornado)"}`);
  console.log(`4. Existem alertas CTO (cto_loss)? ${(ctx.byType?.cto_loss ?? 0) > 0 ? "SIM" : "NAO"}`);
  console.log(`5. Existem alertas PON (pon_loss)? ${(ctx.byType?.pon_loss ?? 0) > 0 ? "SIM" : "NAO"}`);

  if (!ctx.clientTested) {
    console.log("6. Cliente relacionado a alertas? NAO TESTADO -- nenhum contractId informado nesta execucao.");
    console.log("7. external_contract_id corresponde ao contrato do sistema? NAO TESTADO -- rode com um contractId real.");
    console.log("8. PPPoE como chave alternativa? NAO TESTADO nesta execucao.");
    console.log("9. API fornece CTO do cliente? NAO TESTADO nesta execucao.");
    console.log("10. API fornece PON? NAO TESTADO nesta execucao.");
    console.log("11. API fornece OLT? NAO TESTADO nesta execucao.");
    console.log("12. Da pra saber quantidade de ONUs afetadas? SIM, via active_devices_count/total_devices_count na lista de alertas.");
  } else {
    console.log(`6. Cliente pode ser relacionado a esses alertas? ${ctx.clientFound ? "SIM" : "NAO (cliente nao encontrado pra este contrato)"}`);
    console.log(
      `7. external_contract_id=${CONTRACT_ID} corresponde ao contrato do sistema? ${
        ctx.clientFound ? "APARENTA SIM (a OLT Cloud encontrou o cliente) -- confirme manualmente contra o cadastro." : "NAO CONFIRMADO -- cliente nao encontrado com este valor."
      }`
    );
    console.log("8. PPPoE como chave alternativa? NAO TESTADO automaticamente nesta execucao (so external_contract_id foi usado) -- testar manualmente se necessario.");
    console.log(`9. API fornece CTO do cliente? ${ctx.ctoFromResponse ? "SIM" : "NAO CONFIRMADO nesta consulta"}`);
    console.log(`10. API fornece PON? ${ctx.ponFromResponse ? "SIM" : "NAO CONFIRMADO nesta consulta"}`);
    console.log(`11. API fornece OLT? ${ctx.oltFromResponse ? "SIM" : "NAO CONFIRMADO nesta consulta"}`);
    console.log(
      `12. Da pra identificar quantidade de ONUs afetadas? ${
        ctx.chosenAlert?.activeDevicesCount !== null && ctx.chosenAlert?.activeDevicesCount !== undefined
          ? "SIM (active_devices_count)"
          : "SIM na lista geral de alertas; nao confirmado no alerta deste cliente especifico"
      }`
    );
  }

  console.log(
    "13. Da pra distinguir falha individual de coletiva? SIM, quando a OLT Cloud ja classifica o alert_type " +
      "(cto_loss/pon_loss/no_power) -- usar essa classificacao oficial em vez de inferir por bairro ou por ONU isolada."
  );
  console.log(`14. Tempo medio das chamadas: ${avgDurationMs !== null ? `${avgDurationMs}ms (${requestLog.length} chamadas)` : "n/a"}`);

  const limitations = [];
  if (unknownTypesNote(ctx)) limitations.push(unknownTypesNote(ctx));
  if (ctx.clientTested && !ctx.clientFound) limitations.push("Cliente de teste nao encontrado -- confirme se o contractId usado existe na OLT Cloud.");
  if (!ctx.clientTested) limitations.push("Nenhum contractId testado nesta execucao -- perguntas 6-12 sobre o cliente especifico ficam pendentes.");
  limitations.push("Shape exato de GET /api/v2/client/device_alert nao esta 100% documentado -- extracao feita de forma tolerante (ver clientIncidentStatus.ts).");

  console.log("15. Limitacoes encontradas:");
  for (const item of limitations) {
    console.log(`   - ${item}`);
  }
}

function unknownTypesNote(ctx) {
  if (ctx.unknownTypesSeen && ctx.unknownTypesSeen.length > 0) {
    return `alert_type nao mapeados encontrados: ${ctx.unknownTypesSeen.join(", ")} -- nenhuma regra propria criada para eles ainda.`;
  }
  return null;
}

main().catch((error) => {
  console.error("Erro inesperado no script de teste:", error);
  process.exitCode = 1;
});
