import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { requireAuth } from "../auth/authenticate.js";
import { parseBody, parseParams } from "./validation.js";

const contractParams = z.object({ id: z.string().min(1) });
const eventParams = z.object({ id: z.string().min(1), signatureId: z.string().min(1) });
const eventBody = z.object({ event: z.enum(["sign_redirect", "document_view"]) });

export async function registerSignatureRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/v1/contracts/:id/signatures", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(contractParams, request.params);
    const result = await container.signatureService.listSignatures(auth.customerId, params.id);
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_SIGNATURES",
      page: "assinaturas",
      contractId: params.id,
      metadata: { count: result.signatures.length, source: result.source }
    });
    return result;
  });

  app.post("/v1/contracts/:id/signatures/:signatureId/events", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(eventParams, request.params);
    const body = parseBody(eventBody, request.body);

    await container.signatureService.recordEvent(auth.customerId, params.id, params.signatureId, body.event);
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "SIGNATURE_EVENT",
      page: "assinaturas",
      contractId: params.id,
      metadata: { signatureId: params.signatureId, event: body.event }
    });
    return { ok: true };
  });
}
