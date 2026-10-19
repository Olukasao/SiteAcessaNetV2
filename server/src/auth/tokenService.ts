import { createHmac } from "node:crypto";
import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { randomId, safeEqual, sha256 } from "../security/hash.js";

export interface AccessTokenPayload {
  type: "access";
  sub: string;
  sessionId: string;
  tokenId: string;
  exp: number;
}

export interface RefreshTokenPayload {
  type: "refresh";
  sub: string;
  sessionId: string;
  tokenId: string;
  exp: number;
}

/**
 * JWT caseiro (HMAC-SHA256), sem dependencia externa -- mesmo desenho do
 * AcessaNet app (auth/tokenService.ts), sem o tipo "password_change": este
 * backend so tem o fluxo de senha propria (local), que ja devolve sessao
 * completa no primeiro acesso, entao nao existe sessao restrita aqui.
 */
export class TokenService {
  constructor(private readonly config: AppConfig) {}

  issueAccessToken(customerId: string, sessionId: string) {
    const payload: AccessTokenPayload = {
      type: "access",
      sub: customerId,
      sessionId,
      tokenId: randomId("at"),
      exp: unixNow() + this.config.accessTokenTtlSeconds
    };
    return this.sign(payload);
  }

  issueRefreshToken(customerId: string, sessionId: string) {
    const payload: RefreshTokenPayload = {
      type: "refresh",
      sub: customerId,
      sessionId,
      tokenId: randomId("rt"),
      exp: unixNow() + this.config.refreshTokenTtlSeconds
    };
    return {
      token: this.sign(payload),
      tokenId: payload.tokenId,
      tokenHash: sha256(payload.tokenId)
    };
  }

  verifyAccessToken(token: string) {
    const payload = this.verify<AccessTokenPayload>(token);
    if (payload.type !== "access") {
      throw new AppError(401, "INVALID_TOKEN", "Sessao invalida.");
    }
    return payload;
  }

  verifyRefreshToken(token: string) {
    const payload = this.verify<RefreshTokenPayload>(token);
    if (payload.type !== "refresh") {
      throw new AppError(401, "INVALID_TOKEN", "Sessao invalida.");
    }
    return payload;
  }

  private sign(payload: AccessTokenPayload | RefreshTokenPayload) {
    const header = encode({ alg: "HS256", typ: "JWT" });
    const body = encode(payload);
    const signature = this.signature(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  private verify<T extends AccessTokenPayload | RefreshTokenPayload>(token: string): T {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) {
      throw new AppError(401, "INVALID_TOKEN", "Sessao invalida.");
    }

    const expected = this.signature(`${header}.${body}`);
    if (!safeEqual(expected, signature)) {
      throw new AppError(401, "INVALID_TOKEN", "Sessao invalida.");
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (payload.exp <= unixNow()) {
      throw new AppError(401, "TOKEN_EXPIRED", "Sessao expirada.");
    }

    return payload;
  }

  private signature(value: string) {
    return createHmac("sha256", this.config.jwtSecret).update(value).digest("base64url");
  }
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}
