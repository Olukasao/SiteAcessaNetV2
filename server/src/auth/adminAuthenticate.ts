import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors.js";
import type { AdminSessionRepository } from "../repositories/adminSessionRepository.js";
import type { AdminTokenService } from "./adminTokenService.js";
import type { AdminPermission } from "./adminPermissions.js";
import { requirePermission } from "./adminPermissions.js";

/** Mesmo formato de ../auth/authenticate.ts, mas contra admin_sessions -- nunca contra auth_sessions (cliente). */
export function createAdminAuthenticateHook(tokens: AdminTokenService, sessions: AdminSessionRepository) {
  return async function adminAuthenticate(request: FastifyRequest, _reply: FastifyReply) {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError(401, "AUTH_REQUIRED", "Sessao administrativa obrigatoria.");
    }

    const rawToken = authorization.slice("Bearer ".length);
    const payload = tokens.verifyAccessToken(rawToken);
    const now = new Date();

    const session = await sessions.findById(payload.sessionId);
    if (!session || session.revokedAt || session.adminUserId !== payload.sub || session.expiresAt.getTime() <= now.getTime()) {
      throw new AppError(401, "AUTH_REQUIRED", "Sessao administrativa obrigatoria.");
    }

    await sessions.touchActivity(session.id, now);
    request.adminAuth = {
      adminUserId: payload.sub,
      sessionId: payload.sessionId,
      role: payload.role
    };
  };
}

export function requireAdminAuth(request: FastifyRequest) {
  if (!request.adminAuth) {
    throw new AppError(401, "AUTH_REQUIRED", "Sessao administrativa obrigatoria.");
  }
  return request.adminAuth;
}

export function requireAdminPermission(request: FastifyRequest, permission: AdminPermission) {
  const admin = requireAdminAuth(request);
  requirePermission(admin.role, permission);
  return admin;
}
