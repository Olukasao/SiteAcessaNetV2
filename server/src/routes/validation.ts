import { ZodError, type ZodType } from "zod";
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

export function parseParams<T>(schema: ZodType<T>, params: unknown): T {
  return parseBody(schema, params);
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  return parseBody(schema, query);
}
