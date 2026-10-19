import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppContainer } from "../container.js";
import { requireAdminAuth, requireAdminPermission } from "../auth/adminAuthenticate.js";
import { sha256 } from "../security/hash.js";
import { AppError } from "../errors.js";
import { WIFI_MARKETING_VERSION } from "../wifi/wifiRoutes.js";

function clientIpHash(request: FastifyRequest) {
  return sha256(request.ip || "unknown");
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Tela "Marketing" do admin: mostra os visitantes do Wi-Fi publico (cadastro
 * em /login-wifi-publico, src/wifi) que deram opt-in de marketing. Somente leitura -- segue o mesmo padrao
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

    // Wi-Fi publico agora mora no proprio site (src/wifi). O Connect antigo so entra
    // se ainda estiver configurado, somado aos cadastros locais.
    const local = await container.wifi.listMarketingLeads(CONTRACT_LEADS_LIMIT);
    const remote = container.acessanetConnect ? await container.acessanetConnect.listMarketingLeads().catch(() => []) : [];
    const leads = [...local, ...remote];

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

  /**
   * Tira a pessoa da lista de Marketing: no Wi-Fi grava uma recusa de marketing (novo
   * registro de consentimento, o historico fica); na contratacao desmarca o opt-in.
   * Cadastro, pedido e registros de conexao NAO sao apagados. So admin.
   */
  app.delete<{ Params: { source: string; id: string } }>("/admin/api/marketing/leads/:source/:id", async (request) => {
    const admin = requireAdminPermission(request, "marketing.manage");
    const { source, id } = request.params;

    let removed = false;
    if (source === "wifi") {
      if (await container.wifi.isMarketingLead(id)) {
        await container.wifi.recordConsent(id, "marketing", false, WIFI_MARKETING_VERSION);
        removed = true;
      }
    } else if (source === "contrato") {
      const requestId = Number(id);
      if (!Number.isInteger(requestId) || requestId <= 0) throw new AppError(400, "INVALID_ID", "Identificador invalido.");
      removed = await container.contractRequests.removeMarketingOptIn(requestId, admin.adminUserId);
    } else {
      throw new AppError(400, "INVALID_SOURCE", "Origem invalida.");
    }
    if (!removed) throw new AppError(404, "LEAD_NOT_FOUND", "Essa pessoa ja nao esta na lista de marketing.");

    const record = await container.adminUsers.findById(admin.adminUserId);
    await container.adminAuditLog.record({
      adminUserId: admin.adminUserId,
      adminEmail: record?.email ?? null,
      action: "REMOVE_MARKETING_LEAD",
      ipHash: clientIpHash(request),
      userAgent: userAgent(request),
      afterSnapshot: { source, id }
    });

    return { ok: true };
  });
}
