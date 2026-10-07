import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAuth } from "../auth/authenticate.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { AppError } from "../errors.js";
import { sha256 } from "../security/hash.js";
import { parseBody, parseParams, parseQuery } from "./validation.js";
import { BUG_REPORT_CATEGORIES, BUG_REPORT_STATUSES, type BugReportStatus } from "../repositories/bugReportRepository.js";

const createBugReportSchema = z.object({
  category: z.enum(BUG_REPORT_CATEGORIES),
  description: z.string().trim().min(10).max(3000),
  contractId: z.string().trim().min(1).max(80).optional().nullable(),
  page: z.string().trim().max(500).optional().nullable(),
  url: z.string().trim().max(2048).optional().nullable(),
  frontendVersion: z.string().trim().max(100).optional().nullable(),
  clientContext: z.record(z.string(), z.unknown()).optional().nullable()
});

const bugReportListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: z.enum(BUG_REPORT_STATUSES).optional(),
  category: z.enum(BUG_REPORT_CATEGORIES).optional(),
  customer: z.string().trim().max(200).optional(),
  contractId: z.string().trim().max(80).optional(),
  search: z.string().trim().max(300).optional(),
  from: z.string().optional(),
  to: z.string().optional()
});

const idParams = z.object({
  id: z.coerce.number().int().positive()
});

const updateBugReportSchema = z.object({
  status: z.enum(BUG_REPORT_STATUSES).optional(),
  adminNotes: z.string().max(5000).optional().nullable()
});

function parseOptionalDate(value: string | undefined, endOfDate = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (endOfDate && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function clientIpHash(request: FastifyRequest) {
  return sha256(request.ip || "unknown");
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

async function adminIdentity(request: FastifyRequest, container: AppContainer) {
  const admin = requireAdminAuth(request);
  const record = await container.adminUsers.findById(admin.adminUserId);
  return { adminUserId: admin.adminUserId, adminEmail: record?.email ?? null };
}

async function recordAdminAction(
  request: FastifyRequest,
  container: AppContainer,
  action: "VIEW_BUG_REPORTS" | "VIEW_BUG_REPORT" | "UPDATE_BUG_REPORT",
  afterSnapshot?: Record<string, unknown>
) {
  const admin = await adminIdentity(request, container);
  await container.adminAuditLog.record({
    ...admin,
    action,
    ipHash: clientIpHash(request),
    userAgent: userAgent(request),
    afterSnapshot
  });
  return admin;
}

export async function registerBugReportRoutes(app: FastifyInstance, container: AppContainer) {
  app.post("/api/bug-reports", async (request, reply) => {
    const auth = requireAuth(request);
    const body = parseBody(createBugReportSchema, request.body);
    const report = await container.bugReportService.createAuthenticated({
      auth,
      request,
      category: body.category,
      description: body.description,
      contractId: body.contractId || undefined,
      page: body.page || undefined,
      url: body.url || undefined,
      frontendVersion: body.frontendVersion || undefined,
      clientContext: body.clientContext || undefined
    });

    reply.code(201);
    return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
  });

  app.get("/admin/api/bug-reports/summary", async (request) => {
    await recordAdminAction(request, container, "VIEW_BUG_REPORTS", { section: "summary" });
    return container.bugReportService.summary();
  });

  app.get("/admin/api/bug-reports", async (request) => {
    const query = parseQuery(bugReportListQuery, request.query);
    await recordAdminAction(request, container, "VIEW_BUG_REPORTS", { filters: query });
    return container.bugReportService.list({
      page: query.page,
      limit: query.limit,
      status: query.status,
      category: query.category,
      customer: query.customer,
      contractId: query.contractId,
      search: query.search,
      from: parseOptionalDate(query.from),
      to: parseOptionalDate(query.to, true)
    });
  });

  app.get("/admin/api/bug-reports/:id", async (request) => {
    const params = parseParams(idParams, request.params);
    await recordAdminAction(request, container, "VIEW_BUG_REPORT", { reportId: params.id });
    return container.bugReportService.getForAdmin(params.id);
  });

  app.patch("/admin/api/bug-reports/:id", async (request) => {
    const params = parseParams(idParams, request.params);
    const body = parseBody(updateBugReportSchema, request.body);
    if (body.status === undefined && body.adminNotes === undefined) {
      throw new AppError(400, "NO_CHANGES", "Informe status ou notas internas.");
    }
    const admin = await recordAdminAction(request, container, "UPDATE_BUG_REPORT", {
      reportId: params.id,
      status: body.status ?? null,
      notesChanged: body.adminNotes !== undefined
    });
    const updated = await container.bugReportService.updateAdmin({
      id: params.id,
      status: body.status as BugReportStatus | undefined,
      adminNotes: body.adminNotes,
      ...admin
    });
    const history = await container.bugReports.listHistory(params.id);
    return { report: updated, history };
  });
}
