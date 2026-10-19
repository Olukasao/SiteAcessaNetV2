import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAdminPermission } from "../auth/adminAuthenticate.js";
import { AppError } from "../errors.js";
import { safeEqual, sha256 } from "../security/hash.js";
import { parsePtBr } from "./validation.js";
import { rolesWithPermission } from "../auth/adminPermissions.js";
import {
  COVERED_CITIES,
  PRIVACY_NOTICE_VERSION,
  findCatalogPlan,
  isCityCovered,
  listCatalogPlans
} from "../contracting/planCatalog.js";
import { CONTRACT_PROTOCOL_PATTERN, generateContractProtocol } from "../contracting/protocol.js";
import type { AdminAuditAction } from "../repositories/adminAuditLogRepository.js";
import {
  CONTRACT_REQUEST_PERIODS,
  CONTRACT_REQUEST_STATUSES,
  ContractRequestUniqueViolation,
  type ContractRequestDetail
} from "../repositories/contractRequestRepository.js";

/**
 * Solicitacao de Contratacao Online (contrato: CONTRATO-API.md).
 *
 * Publico (sem login): catalogo e envio. NAO existe consulta publica por
 * protocolo (evita vazar dados pessoais por protocolo adivinhado).
 * Admin: requer sessao admin + permissao contratacoes.* (viewer nao acessa).
 *
 * Nenhum dado pessoal e logado aqui: nada de request.log com corpo, e a
 * auditoria guarda so ids/protocolo/status.
 */

/** Formulario publico: limita por IP (hash) pra ninguem encher o banco. Replays idempotentes nao consomem. */
const CREATE_RATE_RULE = { limit: 5, windowMs: 60 * 60 * 1000, cooldownMs: 60 * 60 * 1000 };
const CREATE_BODY_LIMIT = 16 * 1024;
const PROTOCOL_ATTEMPTS = 5;
/** Responsavel precisa poder editar a solicitacao (viewer nem ve dados pessoais). */
const ASSIGNEE_ROLES = rolesWithPermission("contratacoes.update");

/** DDDs validos no Brasil (Anatel). */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92,
  93, 94, 95, 96, 97, 98, 99
]);

/** "" ou so espacos viram null -- o front pode mandar campo opcional vazio. */
function blankToNull(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function optionalText(max: number) {
  return z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
}

const NAME_PATTERN = /^[\p{L}][\p{L}' .-]*$/u;

const cepSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{3}$/, "CEP inválido.")
  .transform((value) => {
    const digits = value.replace(/\D/g, "");
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  });

const whatsappSchema = z
  .string()
  .trim()
  .max(20)
  .regex(/^[\d\s()+-]+$/, "Informe um WhatsApp válido com DDD.")
  .transform((value) => value.replace(/\D/g, ""))
  .refine((digits) => digits.length === 10 || digits.length === 11, "Informe um WhatsApp com DDD.")
  .refine((digits) => VALID_DDDS.has(Number(digits.slice(0, 2))), "DDD inválido.")
  .refine((digits) => digits.length === 10 || digits[2] === "9", "Celular com 11 dígitos deve começar com 9.");

const createSchema = z.object({
  idempotencyKey: z.uuidv4({ error: "Identificador do envio inválido. Recarregue a página." }),
  planId: z.string().trim().min(1).max(40),
  address: z.object({
    cep: cepSchema,
    street: z.string().trim().min(2).max(255),
    number: z.string().trim().min(1).max(20),
    complement: optionalText(120),
    district: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(120),
    uf: z.preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .regex(/^[A-Za-z]{2}$/, "UF inválida.")
        .transform((value) => value.toUpperCase())
        .nullable()
        .optional()
    )
  }),
  customer: z.object({
    name: z
      .string()
      .trim()
      .min(5)
      .max(120)
      .transform((value) => value.replace(/\s+/g, " "))
      .refine((value) => NAME_PATTERN.test(value), "Use apenas letras no nome.")
      .refine((value) => value.split(" ").filter((part) => part.length >= 2).length >= 2, "Informe nome e sobrenome."),
    whatsapp: whatsappSchema,
    // Obrigatorio: e o segundo canal de contato alem do WhatsApp (linhas antigas podem ter e-mail nulo).
    email: z
      .string({ error: "Informe o e-mail." })
      .trim()
      .min(1, "Informe o e-mail.")
      .max(254)
      .pipe(z.email({ error: "E-mail inválido." }))
      .transform((value) => value.toLowerCase())
  }),
  contactPeriod: z.enum(CONTRACT_REQUEST_PERIODS).nullable().optional(),
  notes: optionalText(500),
  /** Ciencia do aviso de privacidade: obrigatoria e literal true. */
  privacyNoticeAck: z.literal(true, { error: "Confirme que leu o aviso de privacidade." }),
  /** Consentimento de marketing: separado, opcional, padrao false. */
  marketingOptIn: z.boolean().default(false),
  /** Campo isca: invisivel pra pessoas, robos costumam preencher. */
  website: z.string().max(200).nullable().optional()
});

const planParams = z.object({ id: z.string().trim().min(1).max(40) });

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD.")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00-03:00`).getTime()), "Data inválida.");

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: z.enum(CONTRACT_REQUEST_STATUSES).optional(),
  planId: z.string().trim().min(1).max(40).optional(),
  from: dateParam.optional(),
  to: dateParam.optional(),
  protocol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CONTRACT_PROTOCOL_PATTERN, "Protocolo inválido.")
    .optional(),
  search: z.string().trim().min(1).max(120).optional()
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

const updateSchema = z
  .object({
    status: z.enum(CONTRACT_REQUEST_STATUSES).optional(),
    assignedAdminId: z.string().trim().min(1).max(191).nullable().optional(),
    note: z.string().trim().min(1).max(2000).optional()
  })
  .strict();

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/** Dia no fuso de Sao Paulo (UTC-3, sem horario de verao desde 2019) -> instante UTC. */
function startOfDayIso(date: string) {
  return new Date(`${date}T00:00:00-03:00`).toISOString();
}

function nextDayIso(date: string) {
  return new Date(new Date(`${date}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function creationResponse(
  record: Pick<ContractRequestDetail, "protocol" | "status" | "createdAt" | "planId" | "planName" | "planPriceText" | "cityCovered">
) {
  return {
    protocol: record.protocol,
    status: record.status,
    createdAt: record.createdAt,
    plan: { id: record.planId, name: record.planName, priceText: record.planPriceText },
    coverage: { cityCovered: record.cityCovered, technicalFeasibility: "pendente" as const }
  };
}

async function audit(
  request: FastifyRequest,
  container: AppContainer,
  adminUserId: string,
  action: AdminAuditAction,
  snapshots: { before?: Record<string, unknown>; after?: Record<string, unknown> }
) {
  const record = await container.adminUsers.findById(adminUserId);
  await container.adminAuditLog.record({
    adminUserId,
    adminEmail: record?.email ?? null,
    action,
    ipHash: sha256(request.ip || "unknown"),
    userAgent: userAgent(request),
    beforeSnapshot: snapshots.before,
    afterSnapshot: snapshots.after
  });
}

export async function registerContractRequestRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/api/contratacao/planos", async () => {
    return {
      plans: listCatalogPlans(),
      coveredCities: [...COVERED_CITIES],
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION
    };
  });

  app.get("/api/contratacao/planos/:id", async (request) => {
    const { id } = parsePtBr(planParams, request.params);
    const plan = findCatalogPlan(id);
    if (!plan) {
      throw new AppError(404, "PLAN_NOT_FOUND", "Plano não encontrado.");
    }
    return { plan };
  });

  app.post("/api/contratacao/solicitacoes", { bodyLimit: CREATE_BODY_LIMIT }, async (request, reply) => {
    const body = parsePtBr(createSchema, request.body);

    // Reenvio (duplo clique, rede instavel): devolve o mesmo protocolo, sem novo registro.
    const replay = await container.contractRequests.findByIdempotencyKey(body.idempotencyKey);
    if (replay) {
      reply.code(200);
      return creationResponse(replay);
    }

    const plan = findCatalogPlan(body.planId);
    if (!plan) {
      throw new AppError(404, "PLAN_NOT_FOUND", "Plano não encontrado.");
    }

    // Cota so e consumida depois do corpo e do plano validos: 400/404 nao gastam.
    const ipHash = sha256(request.ip || "unknown");
    container.rateLimiter.consume(`contract_request:ip:${ipHash}`, CREATE_RATE_RULE);

    const cityCovered = isCityCovered(body.address.city);

    if (body.website) {
      // Robo: resposta com o mesmo formato de sucesso, sem gravar nada.
      reply.code(201);
      return creationResponse({
        protocol: generateContractProtocol(),
        status: "novo",
        createdAt: new Date(),
        planId: plan.id,
        planName: plan.name,
        planPriceText: plan.priceText,
        cityCovered
      });
    }

    for (let attempt = 1; attempt <= PROTOCOL_ATTEMPTS; attempt += 1) {
      try {
        const created = await container.contractRequests.create({
          protocol: generateContractProtocol(),
          idempotencyKey: body.idempotencyKey,
          // Snapshot do catalogo do servidor -- nunca do corpo.
          planId: plan.id,
          planName: plan.name,
          planPriceCents: plan.priceCents,
          planPriceText: plan.priceText,
          cep: body.address.cep,
          street: body.address.street,
          number: body.address.number,
          complement: body.address.complement ?? null,
          district: body.address.district,
          city: body.address.city,
          uf: body.address.uf ?? null,
          cityCovered,
          customerName: body.customer.name,
          whatsapp: body.customer.whatsapp,
          email: body.customer.email ?? null,
          contactPeriod: body.contactPeriod ?? null,
          notes: body.notes ?? null,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          marketingOptIn: body.marketingOptIn,
          ipHash,
          userAgent: userAgent(request)
        });
        reply.code(201);
        return creationResponse(created);
      } catch (error) {
        if (error instanceof ContractRequestUniqueViolation) {
          if (error.field === "idempotency_key") {
            // Corrida entre dois envios simultaneos com a mesma chave.
            const existing = await container.contractRequests.findByIdempotencyKey(body.idempotencyKey);
            if (existing) {
              reply.code(200);
              return creationResponse(existing);
            }
          }
          if (error.field === "protocol" && attempt < PROTOCOL_ATTEMPTS) continue;
        }
        throw error;
      }
    }
    throw new AppError(500, "PROTOCOL_UNAVAILABLE", "Não foi possível registrar agora. Tente novamente.");
  });

  /**
   * Feed para o aviso do chat interno (sistema a sistema, sem sessao de admin): o chat
   * consulta de tempos em tempos com um token proprio. Devolve so o que o aviso precisa
   * (sem endereco, WhatsApp ou e-mail). Sem CONTRACT_FEED_TOKEN a rota nem existe.
   */
  const feedToken = container.config.contractFeed.token;
  if (feedToken) {
    app.get("/api/integracoes/contratacoes/pendentes", async (request, reply) => {
      const header = request.headers.authorization;
      const provided = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!provided || !safeEqual(provided, feedToken)) {
        throw new AppError(401, "FEED_TOKEN_REQUIRED", "Token ausente ou inválido.");
      }
      reply.header("Cache-Control", "no-store");
      const [pendingCount, items] = await Promise.all([
        container.contractRequests.countNew(),
        container.contractRequests.listNewForFeed(20)
      ]);
      return { pendingCount, items };
    });
  }

  app.get("/admin/api/contratacoes/summary", async (request) => {
    requireAdminPermission(request, "contratacoes.read");
    return { newCount: await container.contractRequests.countNew() };
  });

  app.get("/admin/api/contratacoes/assignees", async (request) => {
    requireAdminPermission(request, "contratacoes.read");
    // Todos que atendem contratacoes podem trocar o responsavel (inclusive vendedor).
    return { items: await container.contractRequests.listAssignees(ASSIGNEE_ROLES) };
  });

  app.get("/admin/api/contratacoes", async (request) => {
    const admin = requireAdminPermission(request, "contratacoes.read");
    const query = parsePtBr(listQuery, request.query);
    if (query.from && query.to && query.from > query.to) {
      throw new AppError(400, "VALIDATION_ERROR", "Data inicial depois da final.");
    }
    // Texto da busca pode ser nome/telefone: auditoria registra so que houve busca.
    await audit(request, container, admin.adminUserId, "VIEW_CONTRACT_REQUESTS", {
      after: {
        page: query.page,
        limit: query.limit,
        status: query.status ?? null,
        planId: query.planId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        protocol: query.protocol ?? null,
        hasSearch: Boolean(query.search)
      }
    });
    return container.contractRequests.list({
      page: query.page,
      limit: query.limit,
      status: query.status,
      planId: query.planId,
      fromIso: query.from ? startOfDayIso(query.from) : undefined,
      toIso: query.to ? nextDayIso(query.to) : undefined,
      protocol: query.protocol,
      search: query.search
    });
  });

  app.get("/admin/api/contratacoes/:id", async (request) => {
    const admin = requireAdminPermission(request, "contratacoes.read");
    const { id } = parsePtBr(idParams, request.params);
    const found = await container.contractRequests.findById(id);
    if (!found) {
      throw new AppError(404, "NOT_FOUND", "Solicitação não encontrada.");
    }
    await audit(request, container, admin.adminUserId, "VIEW_CONTRACT_REQUEST", {
      after: { requestId: found.id, protocol: found.protocol }
    });
    return { request: found, events: await container.contractRequests.listEvents(found.id) };
  });

  app.patch("/admin/api/contratacoes/:id", async (request) => {
    const admin = requireAdminPermission(request, "contratacoes.update");
    const { id } = parsePtBr(idParams, request.params);
    const body = parsePtBr(updateSchema, request.body);
    if (body.status === undefined && body.assignedAdminId === undefined && body.note === undefined) {
      throw new AppError(400, "NO_CHANGES", "Informe status, responsável ou nota.");
    }
    if (body.assignedAdminId) {
      const assignee = await container.contractRequests.findAssignee(body.assignedAdminId, ASSIGNEE_ROLES);
      if (!assignee) {
        throw new AppError(400, "INVALID_ASSIGNEE", "Responsável não encontrado ou inativo.");
      }
    }

    const before = await container.contractRequests.findById(id);
    if (!before) {
      throw new AppError(404, "NOT_FOUND", "Solicitação não encontrada.");
    }

    let assignedAdminId = body.assignedAdminId;
    // Qualquer pessoa com contratacoes.update troca o responsavel (a troca fica no historico
    // do pedido e na auditoria). Vendedor que atende pedido sem responsavel passa a ser o responsavel.
    if (admin.role === "vendedor" && !before.assignedAdminId && assignedAdminId === undefined) {
      assignedAdminId = admin.adminUserId;
    }

    const updated = await container.contractRequests.applyChanges(
      id,
      { status: body.status, assignedAdminId, note: body.note },
      admin.adminUserId
    );
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Solicitação não encontrada.");
    }

    // Nota interna pode citar o cliente: auditoria guarda so que houve nota.
    await audit(request, container, admin.adminUserId, "UPDATE_CONTRACT_REQUEST", {
      before: { requestId: before.id, protocol: before.protocol, status: before.status, assignedAdminId: before.assignedAdminId },
      after: {
        requestId: updated.id,
        protocol: updated.protocol,
        status: updated.status,
        assignedAdminId: updated.assignedAdminId,
        noteAdded: body.note !== undefined
      }
    });
    return { request: updated, events: await container.contractRequests.listEvents(updated.id) };
  });
}
