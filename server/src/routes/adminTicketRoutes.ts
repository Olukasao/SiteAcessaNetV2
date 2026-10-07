import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { parseParams, parseQuery } from "./validation.js";
import { sha256 } from "../security/hash.js";
import type { AnalyticsRange } from "../repositories/centralActivityRepository.js";

const periodQuery = z.object({
  period: z.enum(["today", "yesterday", "7d", "30d", "this_month", "custom"]).default("30d"),
  from: z.string().optional(),
  to: z.string().optional()
});

const listQuery = periodQuery.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  status: z.enum(["open", "scheduled", "in_progress", "closed"]).optional(),
  contractId: z.string().trim().max(80).optional(),
  customerId: z.string().trim().max(191).optional(),
  sort: z.enum(["createdAt_desc", "createdAt_asc", "updatedAt_desc", "updatedAt_asc"]).default("createdAt_desc")
});

const exportQuery = listQuery.omit({ page: true, limit: true });

const protocolParams = z.object({
  protocol: z.string().trim().min(1).max(60)
});

function rangeFrom(query: z.infer<typeof periodQuery>): AnalyticsRange {
  const now = new Date();
  const to = query.period === "custom" && query.to ? parseDate(query.to, now) : now;
  const from = new Date(to);

  if (query.period === "today") {
    from.setHours(0, 0, 0, 0);
    const end = new Date(from);
    end.setDate(end.getDate() + 1);
    return { from, to: end };
  }

  if (query.period === "yesterday") {
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const end = new Date(from);
    end.setDate(end.getDate() + 1);
    return { from, to: end };
  }

  if (query.period === "30d") {
    from.setDate(from.getDate() - 30);
    return { from, to };
  }

  if (query.period === "this_month") {
    const start = new Date(to.getFullYear(), to.getMonth(), 1, 0, 0, 0, 0);
    return { from: start, to };
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

async function auditView(
  request: FastifyRequest,
  container: AppContainer,
  action: "VIEW_CHAMADOS" | "VIEW_CHAMADO" | "EXPORT_CHAMADOS",
  afterSnapshot?: Record<string, unknown>
) {
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

export async function registerAdminTicketRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/admin/api/chamados/summary", async (request) => {
    const query = parseQuery(periodQuery, request.query);
    await auditView(request, container, "VIEW_CHAMADOS", { section: "summary", period: query.period });
    return container.adminTicketService.getSummary(rangeFrom(query));
  });

  app.get("/admin/api/chamados", async (request) => {
    const query = parseQuery(listQuery, request.query);
    await auditView(request, container, "VIEW_CHAMADOS", { filters: query });
    return container.adminTicketService.listTickets({
      range: rangeFrom(query),
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      contractId: query.contractId,
      customerId: query.customerId,
      sort: query.sort
    });
  });

  app.get("/admin/api/chamados/export.csv", async (request, reply) => {
    const query = parseQuery(exportQuery, request.query);
    await auditView(request, container, "EXPORT_CHAMADOS", { filters: query });
    const csv = await container.adminTicketService.exportCsv({
      range: rangeFrom(query),
      search: query.search,
      status: query.status,
      contractId: query.contractId,
      customerId: query.customerId,
      sort: query.sort
    });

    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="chamados.csv"`);
    return reply.send(`﻿${csv}`);
  });

  app.get("/admin/api/chamados/:protocol", async (request) => {
    const params = parseParams(protocolParams, request.params);
    const detail = await container.adminTicketService.getDetail(params.protocol);
    await auditView(request, container, "VIEW_CHAMADO", { protocol: params.protocol });
    return detail;
  });
}
