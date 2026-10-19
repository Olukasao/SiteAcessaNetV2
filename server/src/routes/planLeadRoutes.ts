import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { AppError } from "../errors.js";
import { sha256 } from "../security/hash.js";
import { parseBody, parseParams, parseQuery } from "./validation.js";
import { PLAN_LEAD_PERIODS, PLAN_LEAD_STATUSES, type PlanLeadStatus } from "../repositories/planLeadRepository.js";

/** Formulario publico, sem login: limita por IP pra ninguem encher o banco. */
const CREATE_RATE_RULE = { limit: 5, windowMs: 60 * 60 * 1000, cooldownMs: 60 * 60 * 1000 };

const createSchema = z.object({
  planId: z.string().trim().min(1).max(40),
  planName: z.string().trim().min(1).max(120),
  planPrice: z.string().trim().max(40).optional().nullable(),
  name: z.string().trim().min(3).max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((value) => value.replace(/\D/g, "").length >= 10, "Informe um telefone com DDD."),
  cep: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length === 8, "CEP inválido."),
  street: z.string().trim().min(2).max(255),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(120).optional().nullable(),
  district: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2).max(120),
  uf: z.string().trim().max(4).optional().nullable(),
  contactPeriod: z.enum(PLAN_LEAD_PERIODS).optional().nullable(),
  coverageOk: z.boolean().default(false),
  /** Campo isca: invisivel pra pessoas, robos costumam preencher. */
  website: z.string().max(200).optional().nullable()
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: z.enum(PLAN_LEAD_STATUSES).optional(),
  planId: z.string().trim().max(40).optional(),
  city: z.string().trim().max(120).optional(),
  search: z.string().trim().max(200).optional()
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

const updateSchema = z.object({
  status: z.enum(PLAN_LEAD_STATUSES).optional(),
  adminNotes: z.string().max(5000).optional().nullable()
});

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "");
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

async function recordAdminAction(
  request: FastifyRequest,
  container: AppContainer,
  action: "VIEW_PLAN_LEADS" | "UPDATE_PLAN_LEAD",
  afterSnapshot?: Record<string, unknown>
) {
  const admin = requireAdminAuth(request);
  const record = await container.adminUsers.findById(admin.adminUserId);
  await container.adminAuditLog.record({
    adminUserId: admin.adminUserId,
    adminEmail: record?.email ?? null,
    action,
    ipHash: sha256(request.ip || "unknown"),
    userAgent: userAgent(request),
    afterSnapshot
  });
}

export async function registerPlanLeadRoutes(app: FastifyInstance, container: AppContainer) {
  app.post("/api/leads/plan", async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const ipHash = sha256(request.ip || "unknown");
    container.rateLimiter.consume(`plan_lead:ip:${ipHash}`, CREATE_RATE_RULE);

    if (body.website) {
      // Robo: responde como sucesso pra nao ensinar o que foi bloqueado.
      reply.code(201);
      return { ok: true };
    }

    const created = await container.planLeads.create({
      planId: body.planId,
      planName: body.planName,
      planPrice: body.planPrice ?? null,
      name: body.name,
      phone: body.phone,
      cep: formatCep(body.cep),
      street: body.street,
      number: body.number,
      complement: body.complement || null,
      district: body.district || null,
      city: body.city,
      uf: body.uf || null,
      contactPeriod: body.contactPeriod ?? null,
      coverageOk: body.coverageOk,
      ipHash,
      userAgent: userAgent(request)
    });

    reply.code(201);
    return { ok: true, id: created.id };
  });

  app.get("/admin/api/plan-leads/summary", async () => {
    return { newCount: await container.planLeads.countNew() };
  });

  app.get("/admin/api/plan-leads", async (request) => {
    const query = parseQuery(listQuery, request.query);
    await recordAdminAction(request, container, "VIEW_PLAN_LEADS", { filters: query });
    return container.planLeads.list(query);
  });

  app.patch("/admin/api/plan-leads/:id", async (request) => {
    const { id } = parseParams(idParams, request.params);
    const body = parseBody(updateSchema, request.body);
    if (body.status === undefined && body.adminNotes === undefined) {
      throw new AppError(400, "NO_CHANGES", "Informe status ou notas internas.");
    }
    await recordAdminAction(request, container, "UPDATE_PLAN_LEAD", {
      leadId: id,
      status: body.status ?? null,
      notesChanged: body.adminNotes !== undefined
    });
    const updated = await container.planLeads.update({
      id,
      status: body.status as PlanLeadStatus | undefined,
      adminNotes: body.adminNotes
    });
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Pedido não encontrado.");
    }
    return updated;
  });
}
