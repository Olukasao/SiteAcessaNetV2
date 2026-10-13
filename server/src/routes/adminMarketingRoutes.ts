import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppContainer } from "../container.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
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
 */
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
}
