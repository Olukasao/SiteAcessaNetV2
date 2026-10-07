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

    return reply.status(error.statusCode).send(response);
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
