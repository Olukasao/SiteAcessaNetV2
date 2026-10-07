import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { AppError } from "../errors.js";
import { requireAuth } from "../auth/authenticate.js";
import { OwnershipService } from "../security/ownership.js";
import { parseParams } from "./validation.js";

const idParams = z.object({
  id: z.string().min(1)
});

/** Contexto pro log de auditoria SECURITY_CONTRACT_OWNERSHIP_MISMATCH (ver OwnershipService) -- nunca inclui CPF em texto puro, so o hash ja presente na sessao. */
function auditContext(request: FastifyRequest, cpfHash: string) {
  return { log: request.log, cpfHash, endpoint: request.routeOptions?.url || request.url };
}

export async function registerContractRoutes(app: FastifyInstance, container: AppContainer) {
  const ownership = new OwnershipService(container.store, container.sgpClient);

  app.get("/api/me", async (request) => {
    const auth = requireAuth(request);
    const customer = container.store.getCustomer(auth.customerId);

    if (!customer) {
      throw new AppError(401, "AUTH_REQUIRED", "Sessao obrigatoria.");
    }

    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_HOME",
      page: "home"
    });

    return {
      id: customer.id,
      name: customer.name,
      maskedCpf: customer.maskedCpf,
      maskedPhone: customer.maskedPhone
    };
  });

  app.get("/v1/contracts", async (request) => {
    const auth = requireAuth(request);
    const contracts = await container.providers.contracts.getContracts(auth.customerId);
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_CONTRACTS",
      page: "contratos",
      metadata: { count: contracts.length }
    });
    return contracts;
  });

  app.get("/v1/contracts/:id", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    const contract = await ownership.assertContract(auth.customerId, params.id, auditContext(request, auth.cpfHash));
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "SELECT_CONTRACT",
      page: "contrato",
      contractId: params.id
    });
    return contract;
  });

  app.get("/v1/contracts/:id/connection", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    await ownership.assertContract(auth.customerId, params.id, auditContext(request, auth.cpfHash));

    const connection = await container.providers.network.getConnectionStatus(params.id);
    if (!connection) {
      throw new AppError(404, "CONNECTION_NOT_FOUND", "Nao encontramos dados de conexao para este contrato.");
    }

    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_CONNECTION",
      page: "internet",
      contractId: params.id,
      metadata: { health: connection.health, statusSource: connection.statusSource }
    });

    return connection;
  });

  app.get("/v1/contracts/:id/billing", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    const contract = await ownership.assertContract(auth.customerId, params.id, auditContext(request, auth.cpfHash));

    const billing = await container.providers.billing.getBillingSummary(contract);
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_BILLING",
      page: "faturas",
      contractId: params.id,
      metadata: { status: billing.status, source: billing.source }
    });
    return billing;
  });

  app.get("/v1/contracts/:id/invoices", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    const contract = await ownership.assertContract(auth.customerId, params.id, auditContext(request, auth.cpfHash));

    const invoices = await container.providers.billing.listInvoices(contract);
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_INVOICES",
      page: "faturas",
      contractId: params.id,
      metadata: { count: invoices.invoices.length, source: invoices.source }
    });
    return invoices;
  });

  app.post("/v1/contracts/:id/promise", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    const contract = await ownership.assertContract(auth.customerId, params.id, auditContext(request, auth.cpfHash));

    const outcome = await container.paymentPromiseService.requestPromise(contract);

    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "REQUEST_PAYMENT_PROMISE",
      page: "faturas",
      contractId: params.id,
      metadata: {
        released: outcome.released,
        ...(outcome.protocol ? { protocol: outcome.protocol } : {}),
        ...(typeof outcome.releasedDays === "number" ? { releasedDays: outcome.releasedDays } : {})
      }
    });

    return outcome;
  });

  app.get("/v1/contracts/:id/promise", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    await ownership.assertContract(auth.customerId, params.id, auditContext(request, auth.cpfHash));

    return container.paymentPromiseService.getStatus(params.id);
  });

  app.get("/v1/contracts/:id/ticket", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    await ownership.assertContract(auth.customerId, params.id, auditContext(request, auth.cpfHash));

    const ticket = await container.supportService.getCurrentTicket(auth.customerId, params.id);
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_TICKETS",
      page: "chamados",
      contractId: params.id,
      metadata: { hasCurrentTicket: Boolean(ticket) }
    });
    return ticket;
  });
}
