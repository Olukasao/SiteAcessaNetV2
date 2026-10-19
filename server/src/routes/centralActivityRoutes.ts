import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAuth } from "../auth/authenticate.js";
import { OwnershipService } from "../security/ownership.js";
import { parseBody } from "./validation.js";

const activityBodySchema = z.object({
  eventType: z.enum(["VIEW_PLAN", "DOWNLOAD_INVOICE", "GENERATE_PIX", "VIEW_HOME", "VIEW_INVOICES", "VIEW_CONNECTION", "VIEW_TICKETS"]),
  page: z.string().trim().min(1).max(120).optional(),
  contractId: z.string().trim().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export async function registerCentralActivityRoutes(app: FastifyInstance, container: AppContainer) {
  const ownership = new OwnershipService(container.store, container.sgpClient);

  app.post("/v1/central/activity", async (request) => {
    const auth = requireAuth(request);
    const body = parseBody(activityBodySchema, request.body);

    if (body.contractId) {
      await ownership.assertContract(auth.customerId, body.contractId);
    }

    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: body.eventType,
      page: body.page,
      contractId: body.contractId,
      metadata: body.metadata
    });

    return { ok: true };
  });
}
