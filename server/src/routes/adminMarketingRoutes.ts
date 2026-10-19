import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppContainer } from "../container.js";
import { requireAdminAuth, requireAdminPermission } from "../auth/adminAuthenticate.js";
import { AppError } from "../errors.js";
import { sha256 } from "../security/hash.js";

function clientIpHash(request: FastifyRequest) {
  return sha256(request.ip || "unknown");
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Tela "Marketing" do admin: mostra os visitantes do Wi-Fi publico (AcessaNet
 * Connect) que deram opt-in de marketing. Somente leitura -- segue o mesmo padrao
 * de adminAnalyticsRoutes.ts (qualquer admin autenticado pode ver, sem permissao
 * granular propria, igual Analytics/Chamados/Bugs -- so o modulo de Avisos usa
 * permissoes finas hoje). Cada leitura fica no audit log, igual VIEW_ANALYTICS.
 *
 * Tambem lista quem marcou "Quero receber ofertas" na contratacao online. Rota
 * separada de proposito: uma fonte fora do ar nao esconde a outra, e esses dados
 * vem das solicitacoes, entao exigem contratacoes.read (viewer nao ve).
 */
const CONTRACT_LEADS_LIMIT = 2000;

export async function registerAdminMarketingRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/admin/api/marketing/leads", async (request) => {
    const admin = requireAdminAuth(request);

    if (!container.acessanetConnect) {
      throw new AppError(
        503,
        "ACESSANET_CONNECT_NOT_CONFIGURED",
        "Integracao com o AcessaNet Connect nao configurada (ACESSANET_CONNECT_URL/ACESSANET_CONNECT_TOKEN)."
      );
    }

    const leads = await container.acessanetConnect.listMarketingLeads();

    const record = await container.adminUsers.findById(admin.adminUserId);
    await container.adminAuditLog.record({
      adminUserId: admin.adminUserId,
      adminEmail: record?.email ?? null,
      action: "VIEW_MARKETING_LEADS",
      ipHash: clientIpHash(request),
      userAgent: userAgent(request),
      afterSnapshot: { count: leads.length }
    });

    return leads;
  });

  app.get("/admin/api/marketing/contract-leads", async (request) => {
    const admin = requireAdminPermission(request, "contratacoes.read");
    const leads = await container.contractRequests.listMarketingOptIns(CONTRACT_LEADS_LIMIT);

    const record = await container.adminUsers.findById(admin.adminUserId);
    await container.adminAuditLog.record({
      adminUserId: admin.adminUserId,
      adminEmail: record?.email ?? null,
      action: "VIEW_CONTRACT_MARKETING_LEADS",
      ipHash: clientIpHash(request),
      userAgent: userAgent(request),
      afterSnapshot: { count: leads.length }
    });

    return { items: leads };
  });
}
