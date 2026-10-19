import { createHmac } from "node:crypto";
import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { randomId, safeEqual, sha256 } from "../security/hash.js";
import type { AdminRole } from "./adminPermissions.js";

export interface AdminAccessTokenPayload {
  type: "admin_access";
  sub: string;
  sessionId: string;
  role: AdminRole;
  tokenId: string;
  exp: number;
}

export interface AdminRefreshTokenPayload {
  type: "admin_refresh";
  sub: string;
  sessionId: string;
  tokenId: string;
  exp: number;
}

/**
 * Mesmo desenho de ../auth/tokenService.ts (JWT caseiro HMAC-SHA256), mas
 * secret e claims proprios -- nunca deve ser possivel usar um token de
 * cliente para autenticar como admin ou vice-versa, entao os dois nunca
 * compartilham secret nem tipo de payload.
 */
export class AdminTokenService {
  constructor(private readonly config: AppConfig) {}

  issueAccessToken(adminUserId: string, sessionId: string, role: AdminRole) {
    const payload: AdminAccessTokenPayload = {
      type: "admin_access",
      sub: adminUserId,
      sessionId,
      role,
      tokenId: randomId("aat"),
      exp: unixNow() + this.config.adminAccessTokenTtlSeconds
    };
    return this.sign(payload);
  }

  issueRefreshToken(adminUserId: string, sessionId: string) {
    const payload: AdminRefreshTokenPayload = {
      type: "admin_refresh",
      sub: adminUserId,
      sessionId,
      tokenId: randomId("art"),
      exp: unixNow() + this.config.adminRefreshTokenTtlSeconds
    };
    return {
      token: this.sign(payload),
      tokenId: payload.tokenId,
      tokenHash: sha256(payload.tokenId)
    };
  }

  verifyAccessToken(token: string) {
    const payload = this.verify<AdminAccessTokenPayload>(token);
    if (payload.type !== "admin_access") {
      throw new AppError(401, "INVALID_TOKEN", "Sessao administrativa invalida.");
    }
    return payload;
  }

  verifyRefreshToken(token: string) {
    const payload = this.verify<AdminRefreshTokenPayload>(token);
    if (payload.type !== "admin_refresh") {
      throw new AppError(401, "INVALID_TOKEN", "Sessao administrativa invalida.");
    }
    return payload;
  }

  private sign(payload: AdminAccessTokenPayload | AdminRefreshTokenPayload) {
    const header = encode({ alg: "HS256", typ: "JWT" });
    const body = encode(payload);
    const signature = this.signature(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  private verify<T extends AdminAccessTokenPayload | AdminRefreshTokenPayload>(token: string): T {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) {
      throw new AppError(401, "INVALID_TOKEN", "Sessao administrativa invalida.");
    }

    const expected = this.signature(`${header}.${body}`);
    if (!safeEqual(expected, signature)) {
      throw new AppError(401, "INVALID_TOKEN", "Sessao administrativa invalida.");
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (payload.exp <= unixNow()) {
      throw new AppError(401, "TOKEN_EXPIRED", "Sessao administrativa expirada.");
    }

    return payload;
  }

  private signature(value: string) {
    return createHmac("sha256", this.config.adminJwtSecret).update(value).digest("base64url");
  }
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}
