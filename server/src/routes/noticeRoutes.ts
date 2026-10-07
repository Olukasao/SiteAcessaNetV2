import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAuth } from "../auth/authenticate.js";
import { OwnershipService } from "../security/ownership.js";
import { parseParams, parseQuery } from "./validation.js";

const activeQuerySchema = z.object({
  contractId: z.string().min(1).optional()
});

const idParams = z.object({ id: z.string().min(1) });

export async function registerNoticeRoutes(app: FastifyInstance, container: AppContainer) {
  const ownership = new OwnershipService(container.store, container.sgpClient);

  app.get("/v1/notices/active", async (request) => {
    const auth = requireAuth(request);
    const query = parseQuery(activeQuerySchema, request.query);
    const contract = query.contractId
      ? await ownership.assertContract(auth.customerId, query.contractId)
      : undefined;

    const notices = await container.noticeService.listActiveForCustomer({
      customerId: auth.customerId,
      contract: contract
        ? { id: contract.id, city: contract.city, state: contract.state, planName: contract.planName, status: contract.status }
        : undefined
    });
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_NOTICES",
      page: "avisos",
      contractId: contract?.id,
      metadata: { count: notices.length }
    });
    return notices;
  });

  app.post("/v1/notices/:id/view", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    const query = parseQuery(activeQuerySchema, request.query);
    const contract = query.contractId
      ? await ownership.assertContract(auth.customerId, query.contractId)
      : undefined;

    await container.noticeService.recordView(
      {
        customerId: auth.customerId,
        contract: contract
          ? { id: contract.id, city: contract.city, state: contract.state, planName: contract.planName, status: contract.status }
          : undefined
      },
      params.id
    );

    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_NOTICES",
      page: "avisos",
      contractId: contract?.id,
      metadata: { noticeId: params.id, action: "notice_view" }
    });

    return { ok: true };
  });
}
