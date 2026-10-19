import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAuth } from "../auth/authenticate.js";
import { parseBody } from "./validation.js";

const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128)
});

function clientIp(request: FastifyRequest) {
  return request.ip || "unknown";
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

export async function registerAuthRoutes(app: FastifyInstance, container: AppContainer) {
  app.post("/v1/auth/refresh", async (request) => {
    const body = parseBody(refreshSchema, request.body);
    return container.localPasswordAuthService.refresh(body.refreshToken);
  });

  app.post("/api/auth/logout", async (request) => {
    const auth = requireAuth(request);
    await container.centralActivityService.safeEndSession(auth, request);
    await container.localPasswordAuthService.logout(auth.customerId, auth.sessionId);
    return { ok: true };
  });

  app.post("/api/auth/change-password", async (request) => {
    const auth = requireAuth(request);
    const body = parseBody(changePasswordSchema, request.body);
    await container.localPasswordAuthService.changePassword({
      customerId: auth.customerId,
      cpfHash: auth.cpfHash,
      sessionId: auth.sessionId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
      ip: clientIp(request),
      userAgent: userAgent(request)
    });
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "CHANGE_PASSWORD",
      page: "perfil"
    });
    return { ok: true };
  });
}
