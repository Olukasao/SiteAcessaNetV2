import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAdminPermission } from "../auth/adminAuthenticate.js";
import { AppError } from "../errors.js";
import { hashPassword, randomId, sha256 } from "../security/hash.js";
import type { AdminAuditAction } from "../repositories/adminAuditLogRepository.js";
import type { AdminUserRecord } from "../repositories/adminUserRepository.js";
import { periodQuery, rangeFrom } from "./adminAnalyticsRoutes.js";
import { parsePtBr } from "./validation.js";

/**
 * Contas de vendedor(a) + ranking de atendimentos. Criar e desativar contas e so
 * do admin (usuarios.manage); o ranking tambem o editor ve (ranking.read). Esta
 * tela so cria/mexe em role "vendedor" -- nunca cria nem altera outro admin,
 * entao nao serve de caminho para escalar privilegio.
 */
const PASSWORD_MIN = 12;

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(PASSWORD_MIN).max(128)
});

const updateSchema = z
  .object({
    active: z.boolean().optional(),
    password: z.string().min(PASSWORD_MIN).max(128).optional(),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional()
  })
  .refine((value) => value.active !== undefined || value.password !== undefined || value.email !== undefined, {
    message: "Informe active, password ou email."
  });

const idParams = z.object({ id: z.string().min(1).max(191) });

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

async function audit(
  request: FastifyRequest,
  container: AppContainer,
  adminUserId: string,
  action: AdminAuditAction,
  after: Record<string, unknown>
) {
  const record = await container.adminUsers.findById(adminUserId);
  await container.adminAuditLog.record({
    adminUserId,
    adminEmail: record?.email ?? null,
    action,
    ipHash: sha256(request.ip || "unknown"),
    userAgent: userAgent(request),
    // Nunca a senha: so o que mudou.
    afterSnapshot: after
  });
}

/** Sem hash de senha. */
function present(user: AdminUserRecord) {
  return { id: user.id, name: user.name, email: user.email, active: user.active, createdAt: user.createdAt };
}

export async function registerAdminSellerRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/admin/api/vendedores", async (request) => {
    requireAdminPermission(request, "usuarios.manage");
    return { items: (await container.adminUsers.listByRole("vendedor")).map(present) };
  });

  app.post("/admin/api/vendedores", async (request, reply) => {
    const admin = requireAdminPermission(request, "usuarios.manage");
    const body = parsePtBr(createSchema, request.body);

    if (await container.adminUsers.findByEmail(body.email)) {
      throw new AppError(409, "EMAIL_IN_USE", "Já existe um usuário com este e-mail.");
    }

    const created = await container.adminUsers.create({
      id: randomId("admin"),
      email: body.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
      role: "vendedor"
    });
    await audit(request, container, admin.adminUserId, "CREATE_ADMIN_USER", {
      userId: created.id,
      email: created.email,
      role: created.role
    });
    return reply.code(201).send(present(created));
  });

  app.patch("/admin/api/vendedores/:id", async (request) => {
    const admin = requireAdminPermission(request, "usuarios.manage");
    const { id } = parsePtBr(idParams, request.params);
    const body = parsePtBr(updateSchema, request.body);

    const target = await container.adminUsers.findById(id);
    if (!target || target.role !== "vendedor") {
      throw new AppError(404, "NOT_FOUND", "Vendedor não encontrado.");
    }

    if (body.email !== undefined && body.email !== target.email) {
      const taken = await container.adminUsers.findByEmail(body.email);
      if (taken && taken.id !== id) {
        throw new AppError(409, "EMAIL_IN_USE", "Já existe um usuário com este e-mail.");
      }
    }

    const now = new Date();
    if (body.email !== undefined && body.email !== target.email) {
      await container.adminUsers.updateEmail(id, body.email);
    }
    if (body.password !== undefined) {
      await container.adminUsers.updatePassword(id, await hashPassword(body.password));
      // Quem tinha a senha antiga (ou um aparelho perdido) sai na hora.
      await container.adminSessions.revokeAllForAdmin(id, now);
    }
    if (body.active !== undefined && body.active !== target.active) {
      await container.adminUsers.setActive(id, body.active);
      if (!body.active) await container.adminSessions.revokeAllForAdmin(id, now);
    }

    await audit(request, container, admin.adminUserId, "UPDATE_ADMIN_USER", {
      userId: id,
      email: target.email,
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.email !== undefined && body.email !== target.email ? { emailFrom: target.email, emailTo: body.email } : {}),
      passwordReset: body.password !== undefined
    });
    const updated = await container.adminUsers.findById(id);
    return present(updated ?? target);
  });

  app.delete("/admin/api/vendedores/:id", async (request) => {
    const admin = requireAdminPermission(request, "usuarios.manage");
    const { id } = parsePtBr(idParams, request.params);

    const target = await container.adminUsers.findById(id);
    if (!target || target.role !== "vendedor") {
      throw new AppError(404, "NOT_FOUND", "Vendedor não encontrado.");
    }
    // Dois passos de proposito: desativar primeiro evita excluir uma conta ativa por engano.
    if (target.active) {
      throw new AppError(409, "SELLER_ACTIVE", "Desative o acesso antes de excluir.");
    }

    // Sessoes primeiro: o token dela cai na hora, antes de a conta sumir.
    await container.adminSessions.revokeAllForAdmin(id, new Date());
    // Os pedidos dela voltam para a fila (sem responsavel) para outra pessoa assumir.
    const released = await container.contractRequests.releaseAssignedTo(id);
    await container.adminUsers.delete(id);

    await audit(request, container, admin.adminUserId, "DELETE_ADMIN_USER", {
      userId: id,
      email: target.email,
      name: target.name,
      releasedRequests: released
    });
    return { ok: true, released };
  });

  app.get("/admin/api/vendedores/ranking", async (request) => {
    const admin = requireAdminPermission(request, "ranking.read");
    const query = parsePtBr(periodQuery, request.query);
    const range = rangeFrom(query);
    await audit(request, container, admin.adminUserId, "VIEW_SELLER_RANKING", { period: query.period });
    const ranking = await container.contractRequests.sellerRanking(range.from.toISOString(), range.to.toISOString());
    return { range: { from: range.from.toISOString(), to: range.to.toISOString() }, ...ranking };
  });
}
