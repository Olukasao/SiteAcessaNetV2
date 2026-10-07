import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { diagnosisCategoryIds } from "../types.js";
import type { AppContainer } from "../container.js";
import { requireAuth } from "../auth/authenticate.js";
import { normalizeBrazilianPhone } from "../auth/cpf.js";
import { parseBody, parseParams } from "./validation.js";

const idParams = z.object({
  id: z.string().min(1)
});

const diagnosisSchema = z.object({
  contractId: z.string().min(1),
  categoryId: z.enum(diagnosisCategoryIds),
  answers: z.record(z.string(), z.string()).default({})
});

const createTicketSchema = z.object({
  contractId: z.string().min(1),
  diagnosisId: z.string().min(1),
  contactPhone: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .refine((value) => Boolean(normalizeBrazilianPhone(value)), "Informe um telefone brasileiro valido.")
});

export async function registerSupportRoutes(app: FastifyInstance, container: AppContainer) {
  app.get("/v1/support/categories", async () => {
    return container.supportService.categories();
  });

  app.post("/v1/support/diagnosis", async (request) => {
    const auth = requireAuth(request);
    const body = parseBody(diagnosisSchema, request.body);
    const result = await container.supportService.diagnose({
      customerId: auth.customerId,
      contractId: body.contractId,
      categoryId: body.categoryId,
      answers: body.answers
    });
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "CUSTOM",
      page: "atendimento",
      contractId: body.contractId,
      metadata: { action: "DIAGNOSIS", categoryId: body.categoryId, state: result.state }
    });
    return result;
  });

  app.post("/v1/support/tickets", async (request) => {
    const auth = requireAuth(request);
    const body = parseBody(createTicketSchema, request.body);
    const ticket = await container.supportService.createTicket({
      customerId: auth.customerId,
      contractId: body.contractId,
      diagnosisId: body.diagnosisId,
      contactPhone: body.contactPhone
    });
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "OPEN_TICKET",
      page: "atendimento",
      contractId: body.contractId,
      metadata: { ticketId: ticket.id, protocol: ticket.protocol, title: ticket.title }
    });
    return ticket;
  });

  app.get("/v1/support/tickets", async (request) => {
    const auth = requireAuth(request);
    const tickets = await container.supportService.listTickets(auth.customerId);
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_TICKETS",
      page: "chamados",
      metadata: { count: tickets.length }
    });
    return tickets;
  });

  app.get("/v1/support/tickets/:id", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    const ticket = await container.supportService.getTicket(auth.customerId, params.id);
    await container.centralActivityService.safeRecordAuthenticated({
      auth,
      request,
      eventType: "VIEW_TICKET_DETAIL",
      page: "chamado",
      contractId: ticket.contractId,
      metadata: { ticketId: ticket.id, status: ticket.status }
    });
    return ticket;
  });

  app.get("/v1/support/tickets/:id/timeline", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    return container.supportService.getTimeline(auth.customerId, params.id);
  });

  app.get("/v1/support/tickets/:id/appointment", async (request) => {
    const auth = requireAuth(request);
    const params = parseParams(idParams, request.params);
    return container.supportService.getAppointment(auth.customerId, params.id);
  });
}
