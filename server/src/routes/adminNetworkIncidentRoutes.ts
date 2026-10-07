import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { AppError } from "../errors.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { pickString } from "../integrations/sgp/sgpMapper.js";
import { parseParams } from "./validation.js";

const incidentParams = z.object({
  incidentId: z.string().trim().min(1).max(64)
});

/**
 * Painel interno "Incidentes de Rede" (secao 11/22 do pedido) -- so backend
 * por enquanto (sem tela React dedicada ainda). Autenticado como qualquer
 * outra rota /admin/api/* (ver hook global em app.ts). Mostra topologia
 * tecnica (OLT/PON/CTO) que a Central do Assinante nunca ve.
 */
export async function registerAdminNetworkIncidentRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/admin/api/network-incidents", async (request) => {
    requireAdminAuth(request);

    /**
     * ponOutages = fonte concreta (contratos de verdade, via equipment/list
     * -- ver network_incidents) -- sempre disponivel, mesmo se oltCloud
     * estiver reconfigurado/desligado agora (so para de alimentar, nao some
     * o historico). incidents = heuristica antiga (scope cto/pon/olt,
     * sem roster de contrato), preservada sem mudanca (regra 27).
     */
    const ponOutages = await container.networkIncidents.listActive();

    if (!container.oltCloud) {
      return { configured: false, incidents: [], ponOutages };
    }

    return {
      configured: true,
      incidents: container.oltCloud.regionalIncidents.listIncidents(),
      ponOutages
    };
  });

  /**
   * "Ver clientes afetados" (secao 24 do pedido) -- so contract_id fica
   * persistido (regra 16: nunca duplicar cadastro); nome/bairro/cidade/
   * status do contrato sao resolvidos ao vivo no SGP a cada chamada desta
   * rota, nunca guardados. ONU/serial/CTO por cliente NAO estao disponiveis
   * aqui ainda -- so o contract_id e persistido hoje (ver relatorio final).
   */
  app.get("/admin/api/network-incidents/pon-outages/:incidentId/contracts", async (request) => {
    requireAdminAuth(request);

    const params = parseParams(incidentParams, request.params);
    const incident = await container.networkIncidents.findById(params.incidentId);
    if (!incident) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Incidente nao encontrado.");
    }

    const contractIds = await container.networkIncidents.listContractsForIncident(params.incidentId);

    const contracts = await Promise.all(
      contractIds.map(async (contractId) => {
        try {
          const raw = await container.sgpClient.consultCustomerByContract(contractId);
          const record = findContractRecord(raw, contractId);
          if (!record) {
            return { contractId, name: null, status: null, city: null, neighborhood: null };
          }

          return {
            contractId,
            name: pickString(record, ["cliente", "cliente_nome", "clienteNome", "nome", "razao", "razao_social", "razaoSocial"]) || null,
            status: pickString(record, ["status", "status_contrato", "situacao"]) || null,
            city: pickString(record, ["endereco_cidade", "enderecoCidade", "cidade"]) || null,
            neighborhood: pickString(record, ["endereco_bairro", "enderecoBairro", "bairro"]) || null
          };
        } catch {
          return { contractId, name: null, status: null, city: null, neighborhood: null };
        }
      })
    );

    const neighborhoodCounts = new Map<string, number>();
    for (const contract of contracts) {
      if (!contract.neighborhood) continue;
      neighborhoodCounts.set(contract.neighborhood, (neighborhoodCounts.get(contract.neighborhood) ?? 0) + 1);
    }

    return {
      incident,
      contracts,
      neighborhoodDistribution: [...neighborhoodCounts.entries()]
        .map(([neighborhood, count]) => ({ neighborhood, count }))
        .sort((a, b) => b.count - a.count)
    };
  });
}

function findContractRecord(contracts: Record<string, unknown>[], contractId: string) {
  return (
    contracts.find(
      (item) => pickString(item, ["id", "id_contrato", "contratoId", "contrato_id", "idContrato"]) === contractId
    ) ?? contracts[0]
  );
}
