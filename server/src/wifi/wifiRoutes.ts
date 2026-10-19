import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { AppError } from "../errors.js";
import { randomId, randomToken, safeEqual, sha256 } from "../security/hash.js";
import { parsePtBr } from "../routes/validation.js";

/**
 * Captive portal do Wi-Fi publico (Grandstream GWN, fluxo "External Captive
 * Portal" + RADIUS da documentacao oficial):
 *
 * 1. O AP redireciona o celular para /login-wifi-publico?login_url=&ap_mac=&client_mac=&ssid=&orig_url=
 * 2. A pagina manda o cadastro para POST /api/wifi/cadastro. O servidor grava o
 *    visitante + consentimentos e cria um login temporario (usuario/senha
 *    aleatorios), e devolve a URL de login do AP com essas credenciais.
 * 3. O navegador vai para essa URL; o AP pergunta ao RADIUS (radius-bridge, em
 *    server/radius-bridge) e o RADIUS confere em POST /api/wifi/radius/authorize.
 */

export const WIFI_TERMS_VERSION = "2026-10-19";
export const WIFI_MARKETING_VERSION = "2026-10-19";

const CREATE_RATE_RULE = { limit: 10, windowMs: 10 * 60 * 1000, cooldownMs: 10 * 60 * 1000 };
const MAC_PATTERN = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$|^[0-9a-f]{12}$/i;

const optionalShort = (max: number) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().max(max).optional());

const registrationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo.")
    .max(120)
    .transform((value) => value.replace(/\s+/g, " ")),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.").max(254)),
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((digits) => /^\d{2}9\d{8}$/.test(digits), "Informe um celular com DDD."),
  termsAccepted: z.literal(true, { error: "É preciso aceitar as condições de uso." }),
  marketingConsent: z.boolean().default(false),
  context: z
    .object({
      loginUrl: optionalShort(1000),
      apMac: optionalShort(32),
      clientMac: optionalShort(32),
      ssid: optionalShort(64),
      origUrl: optionalShort(1000)
    })
    .default({})
});

const authorizeSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  /** Calling-Station-Id do RADIUS: MAC do celular, quando o AP manda. */
  clientMac: z.string().max(64).optional()
});

function normalizeMac(value: string | undefined | null) {
  if (!value || !MAC_PATTERN.test(value.trim())) return null;
  return value.trim().replace(/[:-]/g, "").toLowerCase().replace(/(..)(?!$)/g, "$1:");
}

/**
 * login_url vem da query string, entao qualquer um pode montar um link com
 * outro destino. So aceita URL http(s) cujo host seja IP privado (o AP na rede
 * local) ou um host liberado em WIFI_LOGIN_HOSTS -- nunca redireciona para um
 * site qualquer com as credenciais.
 */
function trustedLoginUrl(raw: string, allowedHosts: string[]) {
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `http://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const privateIp =
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(host);
  return privateIp || allowedHosts.includes(host) ? url : null;
}

/** Destino depois de conectar: o site que a pessoa tentou abrir, se for http(s); senao a home. */
function safeRedirect(raw: string | undefined) {
  if (!raw) return "https://acessanet.com.br/";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "https://acessanet.com.br/";
  } catch {
    return "https://acessanet.com.br/";
  }
}

export async function registerWifiRoutes(app: FastifyInstance, container: AppContainer) {
  const { wifi: config } = container.config;

  app.post("/api/wifi/cadastro", { bodyLimit: 8 * 1024 }, async (request, reply) => {
    container.rateLimiter.consume(`wifi_registration:ip:${sha256(request.ip || "unknown")}`, CREATE_RATE_RULE);
    const body = parsePtBr(registrationSchema, request.body);

    const visitorId = await container.wifi.upsertVisitor(
      { fullName: body.fullName, email: body.email, phone: body.phone },
      randomId("wifi")
    );
    await container.wifi.recordConsent(visitorId, "terms", true, WIFI_TERMS_VERSION);
    await container.wifi.recordConsent(visitorId, "marketing", body.marketingConsent, WIFI_MARKETING_VERSION);

    const loginUrl = body.context.loginUrl ? trustedLoginUrl(body.context.loginUrl, config.loginHosts) : null;
    if (body.context.loginUrl && !loginUrl) {
      throw new AppError(400, "INVALID_LOGIN_URL", "Não reconhecemos este ponto de Wi-Fi. Desconecte e conecte de novo na rede.");
    }

    reply.code(201);
    if (!loginUrl) {
      // Pagina aberta fora do roteador: cadastro gravado, nada para liberar.
      return { registered: true, redirectUrl: null };
    }

    const username = `wifi_${randomToken(9).replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toLowerCase()}`;
    const password = randomToken(18);
    await container.wifi.createSession({
      visitorId,
      username,
      // Senha aleatoria de alta entropia e uso curto: SHA-256 basta (nao e senha escolhida por pessoa).
      passwordHash: sha256(password),
      apMac: normalizeMac(body.context.apMac),
      clientMac: normalizeMac(body.context.clientMac),
      ssid: body.context.ssid ?? null,
      expiresAt: new Date(Date.now() + config.sessionHours * 60 * 60 * 1000)
    });

    loginUrl.searchParams.set("username", username);
    loginUrl.searchParams.set("password", password);
    loginUrl.searchParams.set("redirect", safeRedirect(body.context.origUrl));
    return { registered: true, redirectUrl: loginUrl.toString() };
  });

  // Sem token configurado a rota nem existe: so o radius-bridge chama, nunca o navegador.
  const radiusToken = config.radiusToken;
  if (!radiusToken) return;

  app.post("/api/wifi/radius/authorize", { bodyLimit: 4 * 1024 }, async (request) => {
    const header = request.headers.authorization;
    const provided = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!provided || !safeEqual(provided, radiusToken)) {
      throw new AppError(401, "RADIUS_TOKEN_REQUIRED", "Token do RADIUS ausente ou inválido.");
    }

    const body = parsePtBr(authorizeSchema, request.body);
    const session = await container.wifi.findSessionByUsername(body.username);
    const now = new Date();
    const valid =
      session !== null &&
      session.expiresAt.getTime() > now.getTime() &&
      safeEqual(session.passwordHash, sha256(body.password)) &&
      // Se o AP informou o MAC nos dois momentos, tem que ser o mesmo aparelho.
      (!session.clientMac || !normalizeMac(body.clientMac) || normalizeMac(body.clientMac) === session.clientMac);

    if (!session || !valid) {
      return { accept: false };
    }
    await container.wifi.markAuthorized(session.id, now);
    return { accept: true, sessionTimeout: Math.max(60, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000)) };
  });
}
