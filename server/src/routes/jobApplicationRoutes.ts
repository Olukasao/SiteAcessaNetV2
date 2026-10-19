import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { AppError } from "../errors.js";
import { sha256 } from "../security/hash.js";
import { parseBody, parseParams, parseQuery } from "./validation.js";
import {
  JOB_APPLICATION_AREAS,
  JOB_APPLICATION_STATUSES,
  type JobApplicationStatus
} from "../repositories/jobApplicationRepository.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Base64 de 5 MB (~6,7 MB) + campos de texto. So esta rota aceita corpo maior que o default (1 MB). */
const CREATE_BODY_LIMIT = 8 * 1024 * 1024;
/** Formulario publico, sem login: limita por IP pra ninguem encher o banco. */
const CREATE_RATE_RULE = { limit: 3, windowMs: 60 * 60 * 1000, cooldownMs: 60 * 60 * 1000 };

/**
 * Tipos aceitos. O conteudo e conferido pelos primeiros bytes (assinatura do
 * arquivo), nao so pela extensao/mime que o navegador informa.
 */
const FILE_TYPES = {
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  doc: { mime: "application/msword", magic: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE2
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: [0x50, 0x4b, 0x03, 0x04] // ZIP
  }
} as const;

const createSchema = z.object({
  name: z.string().trim().min(3).max(200),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(40),
  area: z.enum(JOB_APPLICATION_AREAS).optional().nullable(),
  message: z.string().trim().max(3000).optional().nullable(),
  /** Campo isca: invisivel pra pessoas, robos costumam preencher. */
  website: z.string().max(200).optional().nullable(),
  file: z.object({
    name: z.string().trim().min(1).max(255),
    data: z.string().min(1).max(Math.ceil((MAX_FILE_BYTES * 4) / 3) + 8)
  })
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: z.enum(JOB_APPLICATION_STATUSES).optional(),
  area: z.enum(JOB_APPLICATION_AREAS).optional(),
  search: z.string().trim().max(200).optional()
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

const updateSchema = z.object({
  status: z.enum(JOB_APPLICATION_STATUSES).optional(),
  adminNotes: z.string().max(5000).optional().nullable()
});

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

function resolveFile(name: string, base64: string) {
  const extension = name.toLowerCase().split(".").pop() || "";
  const type = FILE_TYPES[extension as keyof typeof FILE_TYPES];
  if (!type) {
    throw new AppError(400, "INVALID_FILE_TYPE", "Envie o currículo em PDF, DOC ou DOCX.");
  }

  const data = Buffer.from(base64.replace(/^data:[^,]*,/, ""), "base64");
  if (data.length === 0) {
    throw new AppError(400, "INVALID_FILE", "Não foi possível ler o arquivo enviado.");
  }
  if (data.length > MAX_FILE_BYTES) {
    throw new AppError(413, "FILE_TOO_LARGE", "O arquivo deve ter no máximo 5 MB.");
  }
  if (!type.magic.every((byte, index) => data[index] === byte)) {
    throw new AppError(400, "INVALID_FILE_TYPE", "O arquivo não parece ser um PDF, DOC ou DOCX válido.");
  }

  /** Nome so com caracteres seguros pro header de download. */
  const safeName = name.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 200) || `curriculo.${extension}`;
  return { data, mime: type.mime, fileName: safeName };
}

async function recordAdminAction(
  request: FastifyRequest,
  container: AppContainer,
  action: "VIEW_JOB_APPLICATIONS" | "DOWNLOAD_JOB_APPLICATION" | "UPDATE_JOB_APPLICATION",
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

export async function registerJobApplicationRoutes(app: FastifyInstance, container: AppContainer) {
  app.post("/api/careers/applications", { bodyLimit: CREATE_BODY_LIMIT }, async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const ipHash = sha256(request.ip || "unknown");
    container.rateLimiter.consume(`job_application:ip:${ipHash}`, CREATE_RATE_RULE);

    if (body.website) {
      // Robo: responde como sucesso pra nao ensinar o que foi bloqueado.
      reply.code(201);
      return { ok: true };
    }

    const file = resolveFile(body.file.name, body.file.data);
    const created = await container.jobApplications.create({
      name: body.name,
      email: body.email,
      phone: body.phone,
      area: body.area ?? null,
      message: body.message || null,
      fileName: file.fileName,
      fileMime: file.mime,
      fileData: file.data,
      ipHash,
      userAgent: userAgent(request)
    });

    reply.code(201);
    return { ok: true, id: created.id };
  });

  app.get("/admin/api/job-applications/summary", async () => {
    return { newCount: await container.jobApplications.countNew() };
  });

  app.get("/admin/api/job-applications", async (request) => {
    const query = parseQuery(listQuery, request.query);
    await recordAdminAction(request, container, "VIEW_JOB_APPLICATIONS", { filters: query });
    return container.jobApplications.list(query);
  });

  app.get("/admin/api/job-applications/:id/file", async (request, reply) => {
    const { id } = parseParams(idParams, request.params);
    const file = await container.jobApplications.getFile(id);
    if (!file) {
      throw new AppError(404, "NOT_FOUND", "Currículo não encontrado.");
    }
    await recordAdminAction(request, container, "DOWNLOAD_JOB_APPLICATION", { applicationId: id });

    reply
      .header("Content-Type", file.fileMime)
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
      .header("X-Content-Type-Options", "nosniff");
    return reply.send(file.data);
  });

  app.patch("/admin/api/job-applications/:id", async (request) => {
    const { id } = parseParams(idParams, request.params);
    const body = parseBody(updateSchema, request.body);
    if (body.status === undefined && body.adminNotes === undefined) {
      throw new AppError(400, "NO_CHANGES", "Informe status ou notas internas.");
    }
    await recordAdminAction(request, container, "UPDATE_JOB_APPLICATION", {
      applicationId: id,
      status: body.status ?? null,
      notesChanged: body.adminNotes !== undefined
    });
    const updated = await container.jobApplications.update({
      id,
      status: body.status as JobApplicationStatus | undefined,
      adminNotes: body.adminNotes
    });
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Currículo não encontrado.");
    }
    return updated;
  });
}
