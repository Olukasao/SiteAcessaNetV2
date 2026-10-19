import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { AppError } from "../errors.js";
import { safeEqual } from "../security/hash.js";
import { parseParams } from "./validation.js";

const contractParams = z.object({
  contractId: z.string().trim().min(1).max(64)
});

/**
 * Rota SOMENTE PARA TESTE da integracao OLT Cloud -- nunca usar isto como
 * fonte real de dados pro app do cliente. So GET, so leitura.
 *
 * Protecao (independente do hook global de auth de cliente, que este path
 * ignora de proposito -- ver publicRoutes em app.ts):
 * 1. So registrada quando config.oltCloud.debug.enabled === true (default:
 *    desligada em producao, ligada fora dela -- ver config.ts).
 * 2. Exige OLTCLOUD_DEBUG_TOKEN: sem ele a rota nao e registrada, e com ele
 *    o header "x-debug-token" e comparado em tempo constante.
 */
export async function registerDebugOltCloudRoutes(app: FastifyInstance, container: AppContainer) {
  // Falha fechado: sem OLTCLOUD_DEBUG_TOKEN a rota nem existe (ela e publica e devolve dados da rede por contrato).
  const requiredToken = container.config.oltCloud.debug.token;
  if (!container.config.oltCloud.debug.enabled || !requiredToken) {
    return;
  }

  app.get("/api/debug/oltcloud/client-status/:contractId", async (request) => {
    const provided = request.headers["x-debug-token"];
    if (typeof provided !== "string" || !safeEqual(provided, requiredToken)) {
      throw new AppError(401, "DEBUG_TOKEN_REQUIRED", "Header x-debug-token ausente ou invalido.");
    }

    if (!container.oltCloud) {
      throw new AppError(500, "OLTCLOUD_NOT_CONFIGURED", "Integracao OLT Cloud nao configurada (OLTCLOUD_BASE_URL/OLTCLOUD_TOKEN).");
    }

    const params = parseParams(contractParams, request.params);
    const result = await container.oltCloud.service.getClientIncidentStatus({
      external_contract_id: params.contractId
    });

    if (!result.success) {
      return { success: false, affected: false, status: "unknown" };
    }

    if (!result.affected) {
      return { success: true, affected: false };
    }

    return {
      success: true,
      affected: true,
      incident: {
        type: result.incidentType,
        startedAt: result.startedAt,
        olt: result.olt,
        pon: result.pon,
        cto: result.cto,
        affectedDevices: result.affectedDevices
      }
    };
  });
}
