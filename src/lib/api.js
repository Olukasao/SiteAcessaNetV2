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
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function postJson(path, body) {
  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar. Verifique sua internet e tente de novo.");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message;
    throw new ApiError(response.status, message || "Não foi possível enviar agora. Tente novamente em instantes.");
  }
  return payload;
}
