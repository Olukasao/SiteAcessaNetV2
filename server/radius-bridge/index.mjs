// RADIUS do Wi-Fi publico (Grandstream GWN, fluxo External Captive Portal).
//
// O AP recebe usuario/senha temporarios do portal (/login-wifi-publico) e manda
// um Access-Request para ca. Este processo nao guarda nada: pergunta ao site
// (POST /api/wifi/radius/authorize, com token proprio) e responde Accept/Reject.
// Accounting (1813) so e confirmado, para o AP nao reenviar sem parar.
//
// Variaveis (arquivo .env ao lado, carregado com node --env-file):
//   RADIUS_SECRET       segredo compartilhado configurado no AP (obrigatorio)
//   WIFI_RADIUS_TOKEN   mesmo valor do backend do site (obrigatorio)
//   WIFI_API_URL        default https://acessanet.com.br
//   RADIUS_CLIENTS      IPs dos APs aceitos, separados por virgula (vazio = qualquer)
//   RADIUS_AUTH_PORT    default 1812   RADIUS_ACCT_PORT default 1813

import dgram from "node:dgram";
import radius from "radius";

export function loadConfig(env = process.env) {
  const config = {
    secret: env.RADIUS_SECRET ?? "",
    token: env.WIFI_RADIUS_TOKEN ?? "",
    apiUrl: (env.WIFI_API_URL || "https://acessanet.com.br").replace(/\/+$/, ""),
    clients: (env.RADIUS_CLIENTS ?? "").split(",").map((ip) => ip.trim()).filter(Boolean),
    authPort: Number(env.RADIUS_AUTH_PORT || 1812),
    acctPort: Number(env.RADIUS_ACCT_PORT || 1813),
    timeoutMs: Number(env.WIFI_API_TIMEOUT_MS || 5000)
  };
  if (config.secret.length < 16) throw new Error("RADIUS_SECRET precisa ter pelo menos 16 caracteres.");
  if (config.token.length < 32) throw new Error("WIFI_RADIUS_TOKEN precisa ter pelo menos 32 caracteres.");
  return config;
}

/** Pergunta ao site. Qualquer falha (rede, timeout, 5xx) = recusa: nunca libera no escuro. */
export async function askSite(config, { username, password, clientMac }, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${config.apiUrl}/api/wifi/radius/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ username, password, ...(clientMac ? { clientMac } : {}) }),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    if (!response.ok) return { accept: false, reason: `http_${response.status}` };
    const body = await response.json();
    return body?.accept === true
      ? { accept: true, sessionTimeout: Number(body.sessionTimeout) || 3600 }
      : { accept: false, reason: "denied" };
  } catch (error) {
    return { accept: false, reason: error?.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}

/** Monta a resposta a um Access-Request ja decodificado. */
export async function handleAccessRequest(config, packet, ask = (input) => askSite(config, input)) {
  const username = packet.attributes["User-Name"];
  const password = packet.attributes["User-Password"];
  const clientMac = packet.attributes["Calling-Station-Id"];
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return { code: "Access-Reject", attributes: [], reason: "missing_credentials" };
  }
  const result = await ask({ username, password, clientMac: typeof clientMac === "string" ? clientMac : undefined });
  if (!result.accept) return { code: "Access-Reject", attributes: [], reason: result.reason };
  return {
    code: "Access-Accept",
    attributes: [
      ["Session-Timeout", result.sessionTimeout],
      ["Acct-Interim-Interval", 600]
    ],
    reason: "ok"
  };
}

function log(event, fields) {
  // Nunca a senha; usuario e temporario e aleatorio.
  console.log(JSON.stringify({ time: new Date().toISOString(), event, ...fields }));
}

export function start(config = loadConfig()) {
  const allowed = (address) => config.clients.length === 0 || config.clients.includes(address);

  const auth = dgram.createSocket("udp4");
  auth.on("message", async (message, rinfo) => {
    if (!allowed(rinfo.address)) return log("ignored_client", { from: rinfo.address });
    let packet;
    try {
      packet = radius.decode({ packet: message, secret: config.secret });
    } catch {
      // Segredo errado ou pacote invalido (inclui Message-Authenticator que nao confere).
      return log("bad_packet", { from: rinfo.address });
    }
    if (packet.code !== "Access-Request") return;
    const result = await handleAccessRequest(config, packet);
    const response = radius.encode_response({ packet, code: result.code, secret: config.secret, attributes: result.attributes });
    auth.send(response, 0, response.length, rinfo.port, rinfo.address);
    log(result.code === "Access-Accept" ? "accept" : "reject", { from: rinfo.address, user: packet.attributes["User-Name"], reason: result.reason });
  });

  const acct = dgram.createSocket("udp4");
  acct.on("message", (message, rinfo) => {
    if (!allowed(rinfo.address)) return;
    try {
      const packet = radius.decode({ packet: message, secret: config.secret });
      if (packet.code !== "Accounting-Request") return;
      const response = radius.encode_response({ packet, code: "Accounting-Response", secret: config.secret });
      acct.send(response, 0, response.length, rinfo.port, rinfo.address);
    } catch {
      log("bad_packet", { from: rinfo.address, port: "acct" });
    }
  });

  auth.bind(config.authPort, () => log("listening", { port: config.authPort, api: config.apiUrl, clients: config.clients.length || "any" }));
  acct.bind(config.acctPort, () => log("listening", { port: config.acctPort, kind: "accounting" }));
  return { auth, acct };
}

