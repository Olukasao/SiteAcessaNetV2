import { getApiBaseUrl } from "./clienteApi";

const accessTokenKey = "acessanet.admin.accessToken";
const refreshTokenKey = "acessanet.admin.refreshToken";

export class AdminApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function readAdminTokens() {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null };
  }

  return {
    accessToken: window.localStorage.getItem(accessTokenKey),
    refreshToken: window.localStorage.getItem(refreshTokenKey)
  };
}

export function saveAdminTokens(accessToken, refreshToken) {
  window.localStorage.setItem(accessTokenKey, accessToken);
  window.localStorage.setItem(refreshTokenKey, refreshToken);
}

export function clearAdminTokens() {
  window.localStorage.removeItem(accessTokenKey);
  window.localStorage.removeItem(refreshTokenKey);
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${getApiBaseUrl()}${path}`;
}

function getErrorPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const nested = payload.error && typeof payload.error === "object" ? payload.error : {};

  return {
    code: payload.code || nested.code || (typeof payload.error === "string" ? payload.error : undefined),
    message: payload.message || nested.message,
    details: payload.details || nested.details
  };
}

async function refreshAdminAccessToken() {
  const { refreshToken } = readAdminTokens();
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(buildUrl("/admin/api/auth/refresh"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.accessToken || !payload?.refreshToken) {
    clearAdminTokens();
    return null;
  }

  saveAdminTokens(payload.accessToken, payload.refreshToken);
  return payload.accessToken;
}

/** Mesmo formato de clienteApi.js#clienteRequest, mas com token/armazenamento proprios do admin -- nunca reaproveita a sessao de cliente. */
export async function adminRequest(path, options = {}) {
  const { method = "GET", body, auth = true, retryOnUnauthorized = true } = options;
  const headers = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const { accessToken } = readAdminTokens();
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    throw new AdminApiError(0, "NETWORK_ERROR", "Não foi possível conectar à API AcessaNet.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const payload = await response.json().catch(() => null);

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const nextToken = await refreshAdminAccessToken();
    if (nextToken) {
      return adminRequest(path, { ...options, retryOnUnauthorized: false });
    }
  }

  if (!response.ok) {
    const error = getErrorPayload(payload);
    throw new AdminApiError(
      response.status,
      error.code || "REQUEST_FAILED",
      error.message || "Não foi possível concluir a solicitação.",
      error.details
    );
  }

  return payload;
}

export async function adminLogin(email, password) {
  const result = await adminRequest("/admin/api/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false
  });
  saveAdminTokens(result.accessToken, result.refreshToken);
  return result.admin;
}

export async function adminLogout() {
  try {
    await adminRequest("/admin/api/auth/logout", { method: "POST" });
  } finally {
    clearAdminTokens();
  }
}

export async function adminMe() {
  return adminRequest("/admin/api/auth/me");
}

export async function listNotices() {
  return adminRequest("/admin/api/notices");
}

export async function getNotice(id) {
  return adminRequest(`/admin/api/notices/${id}`);
}

export async function getNoticeHistory(id) {
  return adminRequest(`/admin/api/notices/${id}/history`);
}

export async function createNotice(input) {
  return adminRequest("/admin/api/notices", { method: "POST", body: input });
}

export async function updateNotice(id, input) {
  return adminRequest(`/admin/api/notices/${id}`, { method: "PUT", body: input });
}

export async function duplicateNotice(id) {
  return adminRequest(`/admin/api/notices/${id}/duplicate`, { method: "POST" });
}

export async function setNoticeActive(id, expectedVersion, active) {
  const action = active ? "activate" : "deactivate";
  return adminRequest(`/admin/api/notices/${id}/${action}`, { method: "POST", body: { expectedVersion } });
}

export async function deleteNotice(id, expectedVersion) {
  return adminRequest(`/admin/api/notices/${id}`, { method: "DELETE", body: { expectedVersion } });
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function getAnalyticsOverview(params) {
  return adminRequest(`/admin/api/analytics/overview${buildQuery(params)}`);
}

export async function getCentralAnalytics(params) {
  return adminRequest(`/admin/api/analytics/central${buildQuery(params)}`);
}

export async function listAnalyticsActivity(params) {
  return adminRequest(`/admin/api/analytics/activity${buildQuery(params)}`);
}

export async function listAnalyticsClients(params) {
  return adminRequest(`/admin/api/analytics/clients${buildQuery(params)}`);
}

export async function getAnalyticsClient(id, params) {
  return adminRequest(`/admin/api/analytics/clients/${encodeURIComponent(id)}${buildQuery(params)}`);
}

export async function listAnalyticsEvents() {
  return adminRequest("/admin/api/analytics/events");
}

export async function getBugReportsSummary() {
  return adminRequest("/admin/api/bug-reports/summary");
}

export async function listBugReports(params) {
  return adminRequest(`/admin/api/bug-reports${buildQuery(params)}`);
}

export async function getBugReport(id) {
  return adminRequest(`/admin/api/bug-reports/${encodeURIComponent(id)}`);
}

export async function updateBugReport(id, input) {
  return adminRequest(`/admin/api/bug-reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input
  });
}

export async function getChamadosSummary(params) {
  return adminRequest(`/admin/api/chamados/summary${buildQuery(params)}`);
}

export async function listChamados(params) {
  return adminRequest(`/admin/api/chamados${buildQuery(params)}`);
}

export async function getChamadoDetail(protocol) {
  return adminRequest(`/admin/api/chamados/${encodeURIComponent(protocol)}`);
}

/** Baixa o CSV direto (precisa do header Authorization, por isso nao e um simples <a href>). */
export async function exportChamadosCsv(params) {
  const { accessToken } = readAdminTokens();
  const response = await fetch(buildUrl(`/admin/api/chamados/export.csv${buildQuery(params)}`), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = getErrorPayload(payload);
    throw new AdminApiError(response.status, error.code || "REQUEST_FAILED", error.message || "Não foi possível exportar os chamados.", error.details);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "chamados.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
