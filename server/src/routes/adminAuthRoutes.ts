import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { AppError } from "../errors.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { parseBody } from "./validation.js";
import { sha256 } from "../security/hash.js";

const loginSchema = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(128)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(4096)
});

function clientIp(request: FastifyRequest) {
  return request.ip || "unknown";
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

function clientIpHash(request: FastifyRequest) {
  return sha256(clientIp(request));
}

export async function registerAdminAuthRoutes(app: FastifyInstance, container: AppContainer) {
  app.post("/admin/api/auth/login", async (request) => {
    const body = parseBody(loginSchema, request.body);
    const result = await container.adminAuthService.login({
      email: body.email,
      password: body.password,
      ip: clientIp(request),
      userAgent: userAgent(request)
    });
    await container.adminAuditLog.record({
      adminUserId: result.admin.id,
      adminEmail: result.admin.email,
      action: "ADMIN_LOGIN",
      ipHash: clientIpHash(request),
      userAgent: userAgent(request),
      afterSnapshot: { role: result.admin.role }
    });
    return result;
  });

  app.post("/admin/api/auth/refresh", async (request) => {
    const body = parseBody(refreshSchema, request.body);
    return container.adminAuthService.refresh(body.refreshToken);
  });

  app.post("/admin/api/auth/logout", async (request) => {
    const admin = requireAdminAuth(request);
    const record = await container.adminUsers.findById(admin.adminUserId);
    await container.adminAuditLog.record({
      adminUserId: admin.adminUserId,
      adminEmail: record?.email ?? null,
      action: "ADMIN_LOGOUT",
      ipHash: clientIpHash(request),
      userAgent: userAgent(request)
    });
    await container.adminAuthService.logout(admin.adminUserId, admin.sessionId);
    return { ok: true };
  });

  app.get("/admin/api/auth/me", async (request) => {
    const admin = requireAdminAuth(request);
    const record = await container.adminUsers.findById(admin.adminUserId);
    if (!record) {
      throw new AppError(401, "AUTH_REQUIRED", "Sessao administrativa obrigatoria.");
    }
    return { id: record.id, name: record.name, email: record.email, role: record.role };
  });
}
