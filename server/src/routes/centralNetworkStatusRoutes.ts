import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { AppError } from "../errors.js";
import { requireAuth } from "../auth/authenticate.js";
import { OwnershipService } from "../security/ownership.js";
import { parseQuery } from "./validation.js";

const queryParams = z.object({
  contractId: z.string().trim().min(1).max(64).optional()
});

/**
 * GET /api/central/network-status -- nunca recebe um contractId "solto" sem
 * validar posse: se vier via query, passa por OwnershipService.assertContract
 * (mesmo 404 generico pra "nao existe" e "nao e seu", evita oraculo de
 * enumeracao). Se nao vier, usa o(s) contrato(s) que a PROPRIA sessao ja tem
 * em cache (store.listContracts) -- nunca aceita "o primeiro que achar" sem
 * o customerId da sessao autenticada ter sido usado pra filtrar.
 *
 * Resposta e deliberadamente pobre em informacao (ver types.ts
 * ClientRegionalIncidentStatus vs a resposta publica aqui): nunca serializa
 * confidence/incidentId/topologia -- so o suficiente pra Central mostrar o
 * aviso generico. Nunca serializa OLT/PON/CTO/contratos/serial de terceiros
 * (regra 20 do pedido de deteccao de queda de PON).
 */
export async function registerCentralNetworkStatusRoutes(app: FastifyInstance, container: AppContainer) {
  const ownership = new OwnershipService(container.store, container.sgpClient);

  app.get("/api/central/network-status", async (request) => {
    const auth = requireAuth(request);
    container.rateLimiter.consume(`network-status:${auth.customerId}`, { limit: 30, windowMs: 60_000 });

    const query = parseQuery(queryParams, request.query);
    const contractId = resolveContractId(container, auth.customerId, query.contractId);
    await ownership.assertContract(auth.customerId, contractId);

    /**
     * Fonte precisa (roster real de external_client_contract_id vindo de
     * equipment/list, ver ponOutageDetectionService.ts) tem prioridade
     * sobre a heuristica de topologia abaixo -- so uma leitura local no
     * banco (nunca chama a OLT Cloud na hora da requisicao, regra 31).
     * Se nao achar nada aqui, cai pro comportamento ja existente
     * (RegionalIncidentService), sem nenhuma mudanca de shape pro frontend.
     */
    const ponOutage = await container.networkIncidents.findActiveByContract(contractId);
    if (ponOutage) {
      await container.centralActivityService.safeRecordAuthenticated({
        auth,
        request,
        eventType: "VIEW_NETWORK_STATUS",
        page: "internet",
        contractId,
        metadata: { status: "regional_incident", affected: true, source: "pon_roster" }
      });

      return {
        affected: true,
        status: "regional_incident" as const,
        severity: "warning" as const,
        startedAt: ponOutage.startedAt
      };
    }

    if (!container.oltCloud) {
      await container.centralActivityService.safeRecordAuthenticated({
        auth,
        request,
        eventType: "VIEW_NETWORK_STATUS",
        page: "internet",
        contractId,
        metadata: { status: "unknown", configured: false }
      });
      return { affected: false, status: "unknown" as const };
    }

    const result = await container.oltCloud.regionalIncidents.getRegionalIncidentForClient(contractId);

    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_NETWORK_STATUS",
      page: "internet",
      contractId,
      metadata: { status: result.status, affected: result.affected }
    });

    if (!result.affected) {
      return { affected: false, status: result.status };
    }

    return {
      affected: true,
      status: "regional_incident" as const,
      severity: result.severity,
      startedAt: result.startedAt
    };
  });
}

function resolveContractId(container: AppContainer, customerId: string, requested: string | undefined): string {
  if (requested) {
    return requested;
  }

  const contracts = container.store.listContracts(customerId);
  if (contracts.length === 0) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Nenhum contrato encontrado para esta sessao.");
  }
  if (contracts.length > 1) {
    throw new AppError(400, "CONTRACT_ID_REQUIRED", "Informe contractId -- esta conta tem mais de um contrato.");
  }
  return contracts[0]!.id;
}
