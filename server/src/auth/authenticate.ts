import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors.js";
import type { SessionRepository } from "../repositories/sessionRepository.js";
import type { TokenService } from "./tokenService.js";

/**
 * Hook de autenticacao unico. Mais simples que o do AcessaNet app: so existe
 * um tipo de sessao aqui (login por senha propria ja devolve sessao
 * completa no primeiro acesso), entao nao ha necessidade do tipo
 * PASSWORD_CHANGE_REQUIRED nem de fallback para sessao legada em memoria.
 */
export function createAuthenticateHook(tokens: TokenService, sessions: SessionRepository) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError(401, "AUTH_REQUIRED", "Sessao obrigatoria.");
    }

    const rawToken = authorization.slice("Bearer ".length);
    const payload = tokens.verifyAccessToken(rawToken);
    const now = new Date();

    const session = await sessions.findById(payload.sessionId);
    if (!session || session.revokedAt || session.customerId !== payload.sub || session.expiresAt.getTime() <= now.getTime()) {
      throw new AppError(401, "AUTH_REQUIRED", "Sessao obrigatoria.");
    }

    await sessions.touchActivity(session.id, now);
    request.auth = {
      customerId: payload.sub,
      sessionId: payload.sessionId,
      cpfHash: session.cpfHash
    };
  };
}

export function requireAuth(request: FastifyRequest) {
  if (!request.auth) {
    throw new AppError(401, "AUTH_REQUIRED", "Sessao obrigatoria.");
  }
  return request.auth;
}
