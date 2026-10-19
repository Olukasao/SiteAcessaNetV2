import { AppError } from "../../errors.js";
import type { OltCloudTokenSource } from "./oltCloudClient.js";

export interface OltCloudAuthConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
}

/** Margem de seguranca antes do exp real -- nunca deixa um token expirar NO MEIO de uma chamada em andamento. */
const EXPIRY_SAFETY_MARGIN_MS = 30_000;
/** Usado so quando o JWT nao tem "exp" decodificavel (nunca deveria acontecer na API real) -- bem conservador. */
const FALLBACK_TOKEN_TTL_MS = 5 * 60_000;

/**
 * Login/refresh JWT (POST /api/token, POST /api/token/refresh -- SimpleJWT,
 * confirmado ao vivo contra a instancia real em 2026-10-07: access ~3h,
 * refresh ~24h). Nunca loga usuario/senha/token; cacheia o access token em
 * memoria e so renova quando estiver proximo de expirar ou apos um 401 (ver
 * OltCloudClient#request). Sempre que o refresh token tambem estiver
 * expirado/invalido, cai para um login completo (usuario+senha) de novo.
 */
export class OltCloudAuthClient implements OltCloudTokenSource {
  private accessToken: string | undefined;
  private accessExpiresAt = 0;
  private refreshToken: string | undefined;
  private refreshExpiresAt = 0;
  private inFlight: Promise<string> | undefined;

  constructor(private readonly config: OltCloudAuthConfig) {
    if (!config.baseUrl || !config.username || !config.password) {
      throw new AppError(500, "OLTCLOUD_NOT_CONFIGURED", "Integracao OLT Cloud nao configurada.");
    }
  }

  invalidate(): void {
    this.accessToken = undefined;
    this.accessExpiresAt = 0;
  }

  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessExpiresAt - EXPIRY_SAFETY_MARGIN_MS) {
      return this.accessToken;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.renew();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = undefined;
    }
  }

  private async renew(): Promise<string> {
    if (this.refreshToken && Date.now() < this.refreshExpiresAt - EXPIRY_SAFETY_MARGIN_MS) {
      try {
        return await this.refresh();
      } catch {
        // Refresh token pode ter sido revogado do lado da OLT Cloud antes do
        // proprio exp -- cai pro login completo abaixo em vez de propagar.
      }
    }

    return this.login();
  }

  private async login(): Promise<string> {
    const body = await this.post("/api/token", {
      username: this.config.username,
      password: this.config.password
    });

    if (!body.access || !body.refresh) {
      throw new AppError(502, "OLTCLOUD_AUTH_FAILED", "Resposta de login invalida da OLT Cloud.");
    }

    this.applyAccess(body.access);
    this.applyRefresh(body.refresh);
    return this.accessToken!;
  }

  private async refresh(): Promise<string> {
    const body = await this.post("/api/token/refresh", { refresh: this.refreshToken! });

    if (!body.access) {
      throw new AppError(502, "OLTCLOUD_AUTH_FAILED", "Resposta de refresh invalida da OLT Cloud.");
    }

    this.applyAccess(body.access);
    return this.accessToken!;
  }

  private applyAccess(token: string) {
    this.accessToken = token;
    this.accessExpiresAt = decodeJwtExpiryMs(token) ?? Date.now() + FALLBACK_TOKEN_TTL_MS;
  }

  private applyRefresh(token: string) {
    this.refreshToken = token;
    this.refreshExpiresAt = decodeJwtExpiryMs(token) ?? Date.now() + FALLBACK_TOKEN_TTL_MS;
  }

  private async post(path: string, body: Record<string, string>): Promise<{ access?: string; refresh?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timer);
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new AppError(
        502,
        aborted ? "OLTCLOUD_TIMEOUT" : "OLTCLOUD_AUTH_FAILED",
        aborted ? "Tempo limite ao autenticar na OLT Cloud." : "Nao foi possivel autenticar na OLT Cloud agora."
      );
    }
    clearTimeout(timer);

    if (!response.ok) {
      throw new AppError(502, "OLTCLOUD_AUTH_FAILED", "Credenciais da OLT Cloud invalidas ou expiradas.", {
        path,
        upstreamStatus: response.status
      });
    }

    try {
      return (await response.json()) as { access?: string; refresh?: string };
    } catch {
      throw new AppError(502, "OLTCLOUD_AUTH_FAILED", "Resposta de autenticacao invalida da OLT Cloud.");
    }
  }
}

/** So le "exp" (nao verifica assinatura -- confiamos no canal HTTPS direto com a API que acabou de emitir este token). */
function decodeJwtExpiryMs(token: string): number | undefined {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) {
      return undefined;
    }

    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
