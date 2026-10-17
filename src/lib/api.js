// Base da API do backend da AcessaNet (mesmo servidor da Central e do admin).
// Em produção o site e a API ficam no mesmo domínio (caminho relativo); em
// desenvolvimento aponta para o backend local, ou para VITE_ACESSANET_API_URL.
export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_ACESSANET_API_URL;
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "");
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://localhost:9531";
  }
  return "";
}

export class ApiError extends Error {
  // `code`/`details`/`retryAfter` vêm do corpo de erro do backend
  // ({ error: { code, message, details } }) e do cabeçalho Retry-After.
  constructor(status, message, { code = null, details = null, retryAfter = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

async function request(path, init, fallbackMessage) {
  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, init);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(0, "Não foi possível conectar. Verifique sua internet e tente de novo.");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message;
    const retryHeader = Number(response.headers.get("Retry-After"));
    throw new ApiError(response.status, message || fallbackMessage, {
      code: payload?.error?.code ?? null,
      details: payload?.error?.details ?? null,
      retryAfter: Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : (payload?.error?.details?.retryAfterSeconds ?? null),
    });
  }
  return payload;
}

export function getJson(path, { signal } = {}) {
  return request(path, { method: "GET", headers: { Accept: "application/json" }, signal }, "Não foi possível carregar agora. Tente novamente em instantes.");
}

export function postJson(path, body) {
  return request(
    path,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "Não foi possível enviar agora. Tente novamente em instantes."
  );
}
