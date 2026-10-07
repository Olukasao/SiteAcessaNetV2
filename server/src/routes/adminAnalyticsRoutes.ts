import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { parseParams, parseQuery } from "./validation.js";
import { sha256 } from "../security/hash.js";

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
  const to = query.period === "custom" && query.to ? parseDate(query.to, now) : now;
  const from = new Date(to);

  if (query.period === "today") {
    from.setHours(0, 0, 0, 0);
    const end = new Date(from);
    end.setDate(end.getDate() + 1);
    return { from, to: end };
  }

  if (query.period === "30d") {
    from.setDate(from.getDate() - 30);
    return { from, to };
  }

  if (query.period === "custom") {
    return {
      from: query.from ? parseDate(query.from, from) : from,
      to
    };
  }

  from.setDate(from.getDate() - 7);
  return { from, to };
}

function parseDate(value: string, fallback: Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
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
