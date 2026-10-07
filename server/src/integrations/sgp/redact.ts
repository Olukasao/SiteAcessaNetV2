export function redactSgpPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(redactSgpPayload);
  }

  const record = payload as Record<string, unknown>;
  const clone: Record<string, unknown> = {};
  const sensitiveKeys = new Set(["token", "app", "password", "senha", "authorization", "cpf", "cnpj", "celular", "telefone", "email"]);

  for (const [key, value] of Object.entries(record)) {
    const lowerKey = key.toLowerCase();
    if (
      sensitiveKeys.has(lowerKey) ||
      lowerKey.includes("token") ||
      lowerKey.includes("password") ||
      lowerKey.includes("senha") ||
      lowerKey.includes("cpf") ||
      lowerKey.includes("cnpj") ||
      lowerKey.includes("boleto") ||
      lowerKey.includes("pix") ||
      lowerKey.includes("linhadigitavel") ||
      lowerKey.includes("codigobarras") ||
      lowerKey.includes("barcode")
    ) {
      clone[key] = value === null || value === undefined ? value : "***REDACTED***";
      continue;
    }

    clone[key] = redactSgpPayload(value);
  }

  return clone;
}
