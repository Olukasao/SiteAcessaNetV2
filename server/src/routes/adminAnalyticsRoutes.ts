import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { parseParams, parseQuery } from "./validation.js";
import { sha256 } from "../security/hash.js";
import { addDays, parseSaoPauloDate, startOfSaoPauloDay } from "../analytics/saoPauloTime.js";

const periodQuery = z.object({
  period: z.enum(["today", "7d", "30d", "custom"]).default("7d"),
  from: z.string().optional(),
  to: z.string().optional()
});

const paginationQuery = periodQuery.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const activityQuery = paginationQuery.extend({
  customer: z.string().trim().max(200).optional(),
  cpf: z.string().trim().max(80).optional(),
  contractId: z.string().trim().max(80).optional(),
  eventType: z.string().trim().max(80).optional(),
  pageName: z.string().trim().max(120).optional(),
  sgpCustomerId: z.string().trim().max(80).optional()
});

const clientsQuery = paginationQuery.extend({
  search: z.string().trim().max(200).optional(),
  contractId: z.string().trim().max(80).optional(),
  eventType: z.string().trim().max(80).optional()
});

const clientParams = z.object({
  id: z.string().min(1).max(191)
});

function rangeFrom(query: z.infer<typeof periodQuery>) {
  const now = new Date();

  if (query.period === "today") {
    const from = startOfSaoPauloDay(now);
    return { from, to: addDays(from, 1) };
  }

  if (query.period === "custom") {
    // Datas do filtro sao dias inteiros: "ate 15/10" inclui o dia 15 todo.
    const toDay = query.to ? parseSaoPauloDate(query.to) : null;
    const to = toDay && /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? "") ? addDays(toDay, 1) : (toDay ?? now);
    const from = (query.from ? parseSaoPauloDate(query.from) : null) ?? addDays(to, -7);
    return { from, to };
  }

  return { from: addDays(now, query.period === "30d" ? -30 : -7), to: now };
}

function clientIpHash(request: FastifyRequest) {
  return sha256(request.ip || "unknown");
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

async function auditView(request: FastifyRequest, container: AppContainer, action: "VIEW_ANALYTICS" | "VIEW_CLIENT" | "VIEW_ACTIVITY", afterSnapshot?: Record<string, unknown>) {
  const admin = requireAdminAuth(request);
  const record = await container.adminUsers.findById(admin.adminUserId);
  await container.adminAuditLog.record({
    adminUserId: admin.adminUserId,
    adminEmail: record?.email ?? null,
    action,
    ipHash: clientIpHash(request),
    userAgent: userAgent(request),
    afterSnapshot
  });
}

export async function registerAdminAnalyticsRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/admin/api/analytics/overview", async (request) => {
    const query = parseQuery(periodQuery, request.query);
    await auditView(request, container, "VIEW_ANALYTICS", { period: query.period });
    return container.centralActivityService.overview(rangeFrom(query));
  });

  app.get("/admin/api/analytics/central", async (request) => {
    const query = parseQuery(periodQuery, request.query);
    await auditView(request, container, "VIEW_ANALYTICS", { period: query.period, section: "central" });
    return container.centralActivityService.overview(rangeFrom(query));
  });

  app.get("/admin/api/analytics/activity", async (request) => {
    const query = parseQuery(activityQuery, request.query);
    await auditView(request, container, "VIEW_ACTIVITY", { filters: query });
    return container.centralActivityService.listActivity({
      range: rangeFrom(query),
      page: query.page,
      limit: query.limit,
      customer: query.customer,
      cpf: query.cpf,
      contractId: query.contractId,
      eventType: query.eventType,
      pageName: query.pageName,
      sgpCustomerId: query.sgpCustomerId
    });
  });

  app.get("/admin/api/analytics/clients", async (request) => {
    const query = parseQuery(clientsQuery, request.query);
    await auditView(request, container, "VIEW_ANALYTICS", { section: "clients", filters: query });
    return container.centralActivityService.listClients({
      range: rangeFrom(query),
      page: query.page,
      limit: query.limit,
      search: query.search,
      contractId: query.contractId,
      eventType: query.eventType
    });
  });

  app.get("/admin/api/analytics/clients/:id", async (request) => {
    const query = parseQuery(periodQuery, request.query);
    const params = parseParams(clientParams, request.params);
    await auditView(request, container, "VIEW_CLIENT", { customerId: params.id, period: query.period });
    const result = await container.centralActivityService.getClient(params.id, rangeFrom(query));
    if (!result) {
      return { client: null };
    }
    return { client: result };
  });

  app.get("/admin/api/analytics/events", async () => {
    return { events: await container.centralActivityService.listEventTypes() };
  });
}
