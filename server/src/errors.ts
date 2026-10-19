import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

const CLIENT_ERRORS: Record<number, { code: string; message: string }> = {
  400: { code: "INVALID_REQUEST_BODY", message: "Corpo da requisicao invalido." },
  413: { code: "PAYLOAD_TOO_LARGE", message: "Dados enviados maiores que o permitido." },
  415: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Formato de envio nao suportado." }
};

export async function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (isAppError(error)) {
    const response: any = {
      error: {
        code: error.code,
        message: error.message,
        requestId: request.id
      }
    };

    if (error.details) {
      response.error.details = error.details;
    }

    /** Cabecalho padrao HTTP alem do campo no corpo (compativel com quem ja le details.retryAfterSeconds). */
    const retryAfter = (error.details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
    if (error.statusCode === 429 && typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
      reply.header("Retry-After", String(Math.max(1, Math.ceil(retryAfter))));
    }

    return reply.status(error.statusCode).send(response);
  }

  /**
   * Erros 4xx do proprio Fastify (corpo grande, JSON invalido, content-type
   * nao suportado...) sao erro do cliente: repassa o status com mensagem
   * generica em pt-BR e loga so o codigo, sem stack nem corpo.
   */
  const fastifyStatus = (error as { statusCode?: unknown }).statusCode;
  const fastifyCode = (error as { code?: unknown }).code;
  // So erros do Fastify (FST_*) ou do parser JSON (SyntaxError + 400): um erro de
  // integracao com statusCode 4xx (ex.: 401 do SGP) continua virando 500.
  const isFastifyClientError =
    (typeof fastifyCode === "string" && fastifyCode.startsWith("FST_")) || error instanceof SyntaxError;
  if (isFastifyClientError && typeof fastifyStatus === "number" && fastifyStatus >= 400 && fastifyStatus < 500) {
    const known = CLIENT_ERRORS[fastifyStatus];
    request.log.info({ statusCode: fastifyStatus, code: fastifyCode }, "Client request error");
    return reply.status(fastifyStatus).send({
      error: {
        code: known?.code ?? "BAD_REQUEST",
        message: known?.message ?? "Requisicao invalida.",
        requestId: request.id
      }
    });
  }

  request.log.error({ err: error }, "Unhandled request error");
  return reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "Nao foi possivel concluir a operacao agora.",
      requestId: request.id
    }
  });
}
