import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { AppError } from "../errors.js";
import { requireAdminAuth } from "../auth/adminAuthenticate.js";
import { normalizeDocument } from "../auth/cpf.js";
import { normalizeOltClient } from "../integrations/oltcloud/oltClientNormalizer.js";
import { getClientConnectionStatus } from "../integrations/oltcloud/oltClientConnectionStatus.js";
import { parseQuery } from "./validation.js";

const MAX_RESULTS = 50;
/** Limite de lookups de status de conexao por busca -- cada um e uma chamada extra a OLT Cloud (equipment/list); busca por contrato/pppoe/documento normalmente devolve so 1-3 resultados, isto so protege contra uma busca por nome muito generica disparar 50 chamadas de uma vez. */
const CONNECTION_LOOKUP_LIMIT = 20;

const searchQuerySchema = z
  .object({
    document: z.string().trim().max(32).optional(),
    name: z.string().trim().max(120).optional(),
    pppoe: z.string().trim().max(120).optional(),
    contractId: z.string().trim().max(64).optional(),
    status: z.string().trim().max(32).optional()
  })
  .refine(
    (value) => Boolean(value.document || value.name || value.pppoe || value.contractId),
    "Informe ao menos um filtro: documento, nome, pppoe ou contrato."
  );

/**
 * Busca de clientes na OLT Cloud (secao "buscar clientes" pedida pelo
 * admin) -- so GET, nunca escreve nada na OLT Cloud (ver OltCloudClient,
 * "somente leitura" por decisao de projeto). Autenticado como qualquer
 * outra rota /admin/api/* (hook global em app.ts); requireAdminAuth aqui
 * so pra obter o adminAuth tipado, igual ao padrao de adminNetworkIncidentRoutes.ts.
 *
 * SEGURANCA: client/list da OLT Cloud devolve "pppoe_password" em texto
 * puro e documento (CPF/CNPJ) sem mascara -- normalizeOltClient() SEMPRE
 * filtra isso antes de qualquer `return` aqui. Nunca repassar o registro
 * bruto da OLT Cloud direto numa resposta HTTP.
 *
 * PRECISAO: o filtro "external_contract_id" do proprio client/list faz
 * match por SUBSTRING, nao por igualdade -- confirmado ao vivo em
 * 2026-10-07: buscar o contrato "5932" tambem devolveu "15932" e "35932"
 * (clientes totalmente diferentes). Quando o admin busca por um contrato
 * especifico, refiltra aqui por igualdade exata antes de responder.
 */
export async function registerAdminOltCloudRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/admin/api/oltcloud/clients", async (request) => {
    requireAdminAuth(request);

    const oltCloud = container.oltCloud;
    if (!oltCloud) {
      throw new AppError(500, "OLTCLOUD_NOT_CONFIGURED", "Integracao OLT Cloud nao configurada.");
    }

    const query = parseQuery(searchQuerySchema, request.query);

    const raw = await oltCloud.client.listClients({
      document: query.document ? normalizeDocument(query.document) : undefined,
      client_name: query.name,
      pppoe: query.pppoe,
      external_contract_id: query.contractId,
      status: query.status
    });

    const matched = query.contractId
      ? raw.filter((item) => String(item.external_contract_id ?? "") === query.contractId)
      : raw;

    const clients = await Promise.all(
      matched.slice(0, MAX_RESULTS).map(async (item, index) => {
        const summary = normalizeOltClient(item);

        if (index >= CONNECTION_LOOKUP_LIMIT || !summary.externalContractId) {
          return { ...summary, connectionStatus: "UNKNOWN" as const, connectionUpdatedAt: null };
        }

        try {
          const connection = await getClientConnectionStatus(oltCloud.client, summary.externalContractId);
          return { ...summary, connectionStatus: connection.status, connectionUpdatedAt: connection.lastStatusUpdate };
        } catch {
          return { ...summary, connectionStatus: "UNKNOWN" as const, connectionUpdatedAt: null };
        }
      })
    );

    return {
      total: matched.length,
      truncated: matched.length > MAX_RESULTS,
      clients
    };
  });
}
