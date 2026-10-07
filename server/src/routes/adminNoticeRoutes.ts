import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import type { NoticeActor } from "../notices/noticeService.js";
import { sha256 } from "../security/hash.js";
import { parseBody, parseParams } from "./validation.js";

const audienceFilterSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("contract"), contractIds: z.array(z.string().trim().min(1)).min(1).max(500) }),
  z.object({ type: z.literal("customer"), customerIds: z.array(z.string().trim().min(1)).min(1).max(500) }),
  z.object({ type: z.literal("plan"), planNames: z.array(z.string().trim().min(1)).min(1).max(50) }),
  z.object({ type: z.literal("city"), cities: z.array(z.string().trim().min(1)).min(1).max(50) }),
  z.object({ type: z.literal("state"), states: z.array(z.string().trim().min(1)).min(1).max(27) }),
  z.object({ type: z.literal("contract_status"), statuses: z.array(z.string().trim().min(1)).min(1).max(10) })
]);

const isoDateTime = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Data invalida.");

/** Mesma regra de segurança de parseSafeHttpUrl (integrations/sgp/providers.ts): so http/https, sem usuario/senha embutido na URL -- nunca aceita javascript:, data: etc. */
const safeImageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "URL de imagem invalida -- use um link http/https direto para a imagem.");

const noticeBodySchema = z.object({
  title: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(3000),
  imageUrl: safeImageUrl.nullable().optional(),
  type: z.enum(["informativo", "atencao", "urgente", "sucesso", "manutencao", "instabilidade"]),
  display: z.enum(["banner", "modal", "card"]),
  priority: z.enum(["baixa", "normal", "alta", "critica"]).default("normal"),
  dismissible: z.boolean().default(true),
  frequency: z.enum(["always", "once_per_session", "once_per_customer"]).default("always"),
  origin: z.enum(["manual", "incidente", "manutencao", "sistema"]).default("manual"),
  audienceFilter: audienceFilterSchema.nullable().default(null),
  startsAt: isoDateTime.nullable().optional(),
  endsAt: isoDateTime.nullable().optional(),
  active: z.boolean().default(true)
});

const updateNoticeBodySchema = noticeBodySchema.extend({
  expectedVersion: z.number().int().min(1)
});

const versionBodySchema = z.object({
  expectedVersion: z.number().int().min(1)
});

const idParams = z.object({ id: z.string().min(1) });

function clientIpHash(request: FastifyRequest) {
  return sha256(request.ip || "unknown");
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

async function actorFrom(request: FastifyRequest, container: AppContainer): Promise<NoticeActor> {
  const admin = requireAdminAuth(request);
  const record = await container.adminUsers.findById(admin.adminUserId);
  return {
    adminUserId: admin.adminUserId,
    adminEmail: record?.email ?? "",
    role: admin.role,
    ipHash: clientIpHash(request),
    userAgent: userAgent(request)
  };
}

/** body sem audienceType: e sempre derivado de audienceFilter.type no servidor, nunca aceito separado do cliente -- evita os dois ficarem inconsistentes entre si. */
function toRepoInput(body: z.infer<typeof noticeBodySchema>) {
  return {
    title: body.title,
    message: body.message,
    imageUrl: body.imageUrl || null,
    type: body.type,
    display: body.display,
    priority: body.priority,
    dismissible: body.dismissible,
    frequency: body.frequency,
    origin: body.origin,
    audienceType: body.audienceFilter?.type ?? ("all" as const),
    audienceFilter: body.audienceFilter,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    active: body.active
  };
}

export async function registerAdminNoticeRoutes(app: FastifyInstance, container: AppContainer) {
  const rateLimit = (adminUserId: string) =>
    container.rateLimiter.consume(`admin_notice_write:admin:${adminUserId}`, {
      limit: 30,
      windowMs: 60_000,
      cooldownMs: 30_000
    });

  app.get("/admin/api/notices", async (request) => {
    const actor = await actorFrom(request, container);
    return container.noticeService.listForAdmin(actor);
  });

  app.get("/admin/api/notices/:id", async (request) => {
    const actor = await actorFrom(request, container);
    const params = parseParams(idParams, request.params);
    return container.noticeService.getForAdmin(actor, params.id);
  });

  app.get("/admin/api/notices/:id/history", async (request) => {
    const actor = await actorFrom(request, container);
    const params = parseParams(idParams, request.params);
    return container.noticeService.getHistory(actor, params.id);
  });

  app.post("/admin/api/notices", async (request) => {
    const actor = await actorFrom(request, container);
    rateLimit(actor.adminUserId);
    const body = parseBody(noticeBodySchema, request.body);
    return container.noticeService.create(actor, toRepoInput(body));
  });

  app.post("/admin/api/notices/:id/duplicate", async (request) => {
    const actor = await actorFrom(request, container);
    rateLimit(actor.adminUserId);
    const params = parseParams(idParams, request.params);
    return container.noticeService.duplicate(actor, params.id);
  });

  app.put("/admin/api/notices/:id", async (request) => {
    const actor = await actorFrom(request, container);
    rateLimit(actor.adminUserId);
    const params = parseParams(idParams, request.params);
    const body = parseBody(updateNoticeBodySchema, request.body);
    return container.noticeService.update(actor, params.id, body.expectedVersion, toRepoInput(body));
  });

  app.post("/admin/api/notices/:id/activate", async (request) => {
    const actor = await actorFrom(request, container);
    rateLimit(actor.adminUserId);
    const params = parseParams(idParams, request.params);
    const body = parseBody(versionBodySchema, request.body);
    return container.noticeService.setActive(actor, params.id, body.expectedVersion, true);
  });

  app.post("/admin/api/notices/:id/deactivate", async (request) => {
    const actor = await actorFrom(request, container);
    rateLimit(actor.adminUserId);
    const params = parseParams(idParams, request.params);
    const body = parseBody(versionBodySchema, request.body);
    return container.noticeService.setActive(actor, params.id, body.expectedVersion, false);
  });

  app.delete("/admin/api/notices/:id", async (request) => {
    const actor = await actorFrom(request, container);
    rateLimit(actor.adminUserId);
    const params = parseParams(idParams, request.params);
    const body = parseBody(versionBodySchema, request.body);
    await container.noticeService.softDelete(actor, params.id, body.expectedVersion);
    return { ok: true };
  });
}
