import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContainer } from "../container.js";
import { parseBody } from "./validation.js";

const cpfOnlySchema = z.object({
  cpf: z.string().min(11).max(18)
});

const setupSchema = z.object({
  cpf: z.string().min(11).max(18),
  newPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128).optional()
});

const loginSchema = z.object({
  cpf: z.string().min(11).max(18),
  password: z.string().min(1).max(128)
});

const verifyResetCodeSchema = z.object({
  cpf: z.string().min(11).max(18),
  code: z.string().min(6).max(6)
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(20).max(256),
  newPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128)
});

function clientIp(request: FastifyRequest) {
  return request.ip || "unknown";
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

export async function registerLocalAuthRoutes(app: FastifyInstance, container: AppContainer) {
  app.post("/api/auth/local/check", async (request) => {
    const body = parseBody(cpfOnlySchema, request.body);
    return container.localPasswordAuthService.checkAccess({ cpf: body.cpf, ip: clientIp(request) });
  });

  app.post("/api/auth/local/setup", async (request) => {
    const body = parseBody(setupSchema, request.body);
    const result = await container.localPasswordAuthService.setupPassword({
      cpf: body.cpf,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
      ip: clientIp(request),
      userAgent: userAgent(request)
    });
    const payload = container.localPasswordAuthService.tokens.verifyAccessToken(result.accessToken);
    const session = await container.authSessions.findById(payload.sessionId);
    await container.centralActivityService.safeRecordLogin({
      sessionId: payload.sessionId,
      customerId: payload.sub,
      cpfHash: session?.cpfHash ?? "",
      request,
      customerName: result.customer.name,
      cpfMasked: result.customer.maskedCpf,
      contractId: result.contracts[0]?.id,
      metadata: { firstAccess: true, contractsCount: result.contracts.length }
    });
    return result;
  });

  app.post("/api/auth/local/login", async (request) => {
    const body = parseBody(loginSchema, request.body);
    const result = await container.localPasswordAuthService.login({
      cpf: body.cpf,
      password: body.password,
      ip: clientIp(request),
      userAgent: userAgent(request)
    });
    const payload = container.localPasswordAuthService.tokens.verifyAccessToken(result.accessToken);
    const session = await container.authSessions.findById(payload.sessionId);
    await container.centralActivityService.safeRecordLogin({
      sessionId: payload.sessionId,
      customerId: payload.sub,
      cpfHash: session?.cpfHash ?? "",
      request,
      customerName: result.customer.name,
      cpfMasked: result.customer.maskedCpf,
      contractId: result.contracts[0]?.id,
      metadata: { contractsCount: result.contracts.length }
    });
    return result;
  });

  app.post("/api/auth/local/forgot-password", async (request) => {
    const body = parseBody(cpfOnlySchema, request.body);
    return container.passwordResetService.requestReset({ cpf: body.cpf, ip: clientIp(request) });
  });

  /**
   * Endpoint auxiliar so pra exibir o e-mail mascarado na Etapa 2 da tela.
   * Diferente de forgot-password, ESTE endpoint revela se o CPF existe (404
   * quando nao existe) -- e um trade-off deliberado entre a UX pedida
   * ("Enviamos um codigo para lu***@gmail.com") e anti-enumeracao total.
   * Mitigado por rate limit (reaproveita a mesma regra de forgot-password
   * dentro do service). Se quiser anti-enumeracao total, o frontend pode
   * parar de chamar este endpoint e mostrar so uma frase generica na Etapa 2.
   */
  app.post("/api/auth/local/forgot-password/masked-email", async (request) => {
    const body = parseBody(cpfOnlySchema, request.body);
    return container.passwordResetService.getMaskedEmail({ cpf: body.cpf });
  });

  app.post("/api/auth/local/verify-reset-code", async (request) => {
    const body = parseBody(verifyResetCodeSchema, request.body);
    return container.passwordResetService.verifyCode({ cpf: body.cpf, code: body.code, ip: clientIp(request) });
  });

  app.post("/api/auth/local/reset-password", async (request) => {
    const body = parseBody(resetPasswordSchema, request.body);
    await container.passwordResetService.resetPassword({
      resetToken: body.resetToken,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
      ip: clientIp(request)
    });
    return { ok: true };
  });
}
