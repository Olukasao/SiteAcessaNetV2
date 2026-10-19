import { ZodError, type ZodType, type core } from "zod";
import { AppError } from "../errors.js";

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, "VALIDATION_ERROR", "Revise os dados enviados.", error.flatten());
    }
    throw error;
  }
}

/**
 * Mensagens padrao do zod em pt-BR (as do zod chegam em ingles ao usuario).
 * Mensagens definidas no proprio schema (refine/regex/{ error }) continuam
 * tendo prioridade -- este mapa so cobre o que o schema nao personalizou.
 */
export function ptBrIssueMessage(issue: core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined || issue.input === null ? "Campo obrigatório." : "Valor em formato inválido.";
    case "too_small":
      return issue.origin === "string"
        ? `Use pelo menos ${String(issue.minimum)} caracteres.`
        : `Valor mínimo: ${String(issue.minimum)}.`;
    case "too_big":
      return issue.origin === "string"
        ? `Use no máximo ${String(issue.maximum)} caracteres.`
        : `Valor máximo: ${String(issue.maximum)}.`;
    case "invalid_format":
      if (issue.format === "email") return "E-mail inválido.";
      if (issue.format === "uuid") return "Identificador inválido.";
      return "Formato inválido.";
    case "invalid_value":
      return "Opção inválida.";
    case "unrecognized_keys":
      return "Campo não permitido.";
    default:
      return "Valor inválido.";
  }
}

/** Igual a parseBody, mas com mensagens pt-BR (usado nas rotas publicas novas). */
export function parsePtBr<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value, { error: ptBrIssueMessage });
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Revise os dados enviados.", result.error.flatten());
  }
  return result.data;
}

export function parseParams<T>(schema: ZodType<T>, params: unknown): T {
  return parseBody(schema, params);
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  return parseBody(schema, query);
}
