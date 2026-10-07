const accessTokenKey = "acessanet.customer.accessToken";
const refreshTokenKey = "acessanet.customer.refreshToken";
/** Chave legada (sem customerId) -- so mantida pra limpar resíduo de versões antigas no logout. Nunca mais escrita. */
const legacySelectedContractKey = "acessanet.customer.selectedContractId";

export class ClienteApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ClienteApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getApiBaseUrl() {
  const configured =
    import.meta.env.VITE_ACESSANET_API_URL ||
    import.meta.env.VITE_CUSTOMER_API_URL ||
    import.meta.env.VITE_API_BASE_URL;

  if (configured?.trim()) {
    return normalizeRuntimeBaseUrl(configured);
  }

  if (typeof window !== "undefined" && isLocalHostname(window.location.hostname)) {
    return "http://localhost:9501";
  }

  return "";
}

export function getChatApiBaseUrl() {
  const configured =
    import.meta.env.VITE_ACESSANET_CHAT_API_URL ||
    import.meta.env.VITE_CHAT_API_URL;

  if (configured?.trim()) {
    return normalizeRuntimeBaseUrl(configured);
  }

  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl) {
    return `${apiBaseUrl}/chat-api`;
  }

  return "/chat-api";
}

function isLocalHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function normalizeRuntimeBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (typeof window === "undefined") {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const pageHostname = window.location.hostname;

    // Uma VITE_ACESSANET_API_URL apontando pra localhost nunca é válida fora
    // de localhost (porta/scheme de dev não existem no domínio de produção).
    // Em vez de tentar "adivinhar" reaproveitando o hostname da página (o
    // que gerava http://dominio-producao:9531, misto HTTP/HTTPS bloqueado
    // pelo navegador), ignora a config e cai no caminho relativo -- backend
    // e frontend estão no mesmo domínio em produção.
    if (isLocalHostname(url.hostname) && !isLocalHostname(pageHostname)) {
      return "";
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

export function readTokens() {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null };
  }

  return {
    accessToken: window.localStorage.getItem(accessTokenKey),
    refreshToken: window.localStorage.getItem(refreshTokenKey)
  };
}

export function saveTokens(accessToken, refreshToken) {
  window.localStorage.setItem(accessTokenKey, accessToken);
  window.localStorage.setItem(refreshTokenKey, refreshToken);
}

export function clearTokens() {
  window.localStorage.removeItem(accessTokenKey);
  window.localStorage.removeItem(refreshTokenKey);
  window.localStorage.removeItem(legacySelectedContractKey);
  clearChatTokenCache();
}

/**
 * Chave do contrato selecionado SEMPRE por customerId -- nunca global. Sem
 * isso, o contrato selecionado por um cliente anterior (mesma aba/navegador)
 * podia ser lido antes da lista de contratos do novo cliente autenticado
 * terminar de carregar. O backend nunca confia nesse valor para autorização
 * (ver OwnershipService no backend); isso é só preferência de UI.
 */
function selectedContractKeyFor(customerId) {
  return `acessanet.customer.selectedContractId.${customerId}`;
}

export function readSelectedContractId(customerId) {
  if (typeof window === "undefined" || !customerId) {
    return null;
  }

  return window.localStorage.getItem(selectedContractKeyFor(customerId));
}

export function saveSelectedContractId(customerId, contractId) {
  if (typeof window === "undefined" || !customerId) {
    return;
  }

  if (!contractId) {
    window.localStorage.removeItem(selectedContractKeyFor(customerId));
    return;
  }

  window.localStorage.setItem(selectedContractKeyFor(customerId), contractId);
}

function buildUrl(path, baseUrl = getApiBaseUrl()) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}${path}`;
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

/**
 * ClienteArea dispara ~7 chamadas em paralelo (connection/billing/tickets/...).
 * Se o access token expirou, todas recebem 401 ao mesmo tempo e cada uma
 * chamava refreshAccessToken() de forma independente -- como o refresh token
 * é de uso único (rotacionado no backend, ver localPasswordAuthService.refresh),
 * só a primeira chamada tinha sucesso; as outras enviavam o refresh token já
 * velho, recebiam INVALID_REFRESH e chamavam clearTokens(), apagando os tokens
 * novos que a primeira tinha acabado de salvar. Resultado: cliente deslogado
 * silenciosamente e "Dados de conexão não carregados" na tela. Esta promise
 * compartilhada garante que só exista UM refresh em voo por vez.
 */
let refreshInFlight = null;

async function refreshAccessToken() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const { refreshToken } = readTokens();
    if (!refreshToken) {
      return null;
    }

    const response = await fetch(buildUrl("/v1/auth/refresh"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.accessToken || !payload?.refreshToken) {
      clearTokens();
      return null;
    }

    saveTokens(payload.accessToken, payload.refreshToken);
    return payload.accessToken;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function clienteRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    retryOnUnauthorized = true,
    signal
  } = options;
  const headers = {
    Accept: "application/json"
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const { accessToken } = readTokens();
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    });
  } catch (error) {
    // Cancelamento intencional (troca de contrato/logout) -- nunca mascarar
    // como falha de rede; quem chamou já sabe que abandonou essa requisição.
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new ClienteApiError(
      0,
      "NETWORK_ERROR",
      "Não foi possível conectar ao servidor da AcessaNet. Tente novamente em instantes.",
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  let payload = null;
  let bodyIsUnparseableJson = false;
  try {
    payload = await response.json();
  } catch {
    bodyIsUnparseableJson = true;
  }

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return clienteRequest(path, { ...options, retryOnUnauthorized: false });
    }
  }

  if (!response.ok) {
    const error = getErrorPayload(payload);
    throw new ClienteApiError(
      response.status,
      error.code || "REQUEST_FAILED",
      error.message || "Não foi possível concluir a solicitação.",
      error.details
    );
  }

  if (bodyIsUnparseableJson) {
    // Resposta 2xx mas com corpo que não é JSON válido -- nunca aconteceria
    // vindo da API de verdade (toda rota devolve JSON). É o sintoma típico
    // do fallback de SPA do hosting devolvendo index.html (HTML) no lugar
    // da resposta esperada, por causa de um proxy/cache desatualizado.
    // Tratar como sucesso silencioso (retornando null) faz o código que
    // chamou essa função quebrar mais adiante com "Cannot read properties
    // of null" em vez de um erro claro e recuperável.
    throw new ClienteApiError(
      response.status,
      "INVALID_RESPONSE",
      "A resposta do servidor veio em um formato inesperado. Atualize a página e tente novamente.",
      undefined
    );
  }

  return payload;
}

/**
 * Passo 1 do login: informa se o CPF já tem uma senha própria do app
 * criada, sem devolver nenhuma sessão. O frontend usa isso pra decidir se
 * mostra a tela de "criar senha" (primeiro acesso) ou "digitar senha"
 * (login normal).
 */
export async function checkLocalAccess(cpf) {
  return clienteRequest("/api/auth/local/check", {
    method: "POST",
    auth: false,
    body: { cpf }
  });
}

/** Primeiro acesso: cria a senha própria do app e já retorna uma sessão completa. */
export async function setupLocalPassword(cpf, newPassword, confirmPassword) {
  const response = await clienteRequest("/api/auth/local/setup", {
    method: "POST",
    auth: false,
    body: { cpf, newPassword, confirmPassword }
  });

  if (!response?.accessToken || !response?.refreshToken) {
    throw new ClienteApiError(500, "INVALID_LOGIN_RESPONSE", "A API retornou uma sessão inválida.");
  }

  saveTokens(response.accessToken, response.refreshToken);
  clearChatTokenCache();
  return response;
}

/**
 * Etapa 1 de "esqueci minha senha": informa o CPF. O backend sempre devolve a
 * mesma mensagem genérica (exista ou não o CPF, tenha ou não e-mail
 * cadastrado) -- nunca use este retorno para decidir UI diferente por
 * "achou"/"não achou".
 */
export async function forgotPassword(cpf) {
  return clienteRequest("/api/auth/local/forgot-password", {
    method: "POST",
    auth: false,
    body: { cpf }
  });
}

/**
 * Busca o e-mail mascarado (ex.: "lu***@gmail.com") só para exibição na
 * Etapa 2. Diferente de forgotPassword, este endpoint pode devolver 404
 * quando o CPF não é encontrado -- por isso o chamador deve tratar o erro
 * mostrando uma mensagem genérica, nunca "CPF não encontrado" de forma crua.
 */
export async function getMaskedEmailForReset(cpf) {
  return clienteRequest("/api/auth/local/forgot-password/masked-email", {
    method: "POST",
    auth: false,
    body: { cpf }
  });
}

/** Etapa 2: valida o código OTP e devolve um resetToken de uso único (10 min) para a Etapa 3. */
export async function verifyResetCode(cpf, code) {
  return clienteRequest("/api/auth/local/verify-reset-code", {
    method: "POST",
    auth: false,
    body: { cpf, code }
  });
}

/** Etapa 3: redefine a senha usando o resetToken devolvido por verifyResetCode. */
export async function resetPasswordWithToken(resetToken, newPassword, confirmPassword) {
  return clienteRequest("/api/auth/local/reset-password", {
    method: "POST",
    auth: false,
    body: { resetToken, newPassword, confirmPassword }
  });
}

/** Perfil > Segurança > Alterar senha. Requer sessão ativa -- o backend identifica o cliente pela sessão, nunca por um id enviado aqui. */
export async function changePassword(currentPassword, newPassword, confirmPassword) {
  return clienteRequest("/api/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword, confirmPassword }
  });
}

/** Login normal: CPF + senha própria do app já criada. */
export async function loginLocal(cpf, password) {
  const response = await clienteRequest("/api/auth/local/login", {
    method: "POST",
    auth: false,
    body: { cpf, password }
  });

  if (!response?.accessToken || !response?.refreshToken) {
    throw new ClienteApiError(500, "INVALID_LOGIN_RESPONSE", "A API retornou uma sessão inválida.");
  }

  saveTokens(response.accessToken, response.refreshToken);
  clearChatTokenCache();
  return response;
}

/**
 * Login por CPF + senha (fluxo integrado ao SGP). Diferente de loginWithCpf,
 * a resposta pode trazer requirePasswordChange=true (senha inicial do SGP,
 * "primeiro acesso"): nesse caso o accessToken retornado só autoriza a troca
 * de senha (ver firstAccessChangePassword) e NÃO deve ser salvo com
 * saveTokens, porque não é uma sessão completa.
 */
export async function loginWithPassword(cpf, password) {
  const response = await clienteRequest("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { cpf: normalizeCpf(cpf), password }
  });

  if (!response?.accessToken) {
    throw new ClienteApiError(500, "INVALID_LOGIN_RESPONSE", "A API retornou uma sessão inválida.");
  }

  if (response.requirePasswordChange) {
    return response;
  }

  if (!response.refreshToken) {
    throw new ClienteApiError(500, "INVALID_LOGIN_RESPONSE", "A API retornou uma sessão inválida.");
  }

  saveTokens(response.accessToken, response.refreshToken);
  clearChatTokenCache();
  return response;
}

/**
 * Conclui o primeiro acesso trocando a senha inicial do SGP por uma nova.
 * Usa o accessToken restrito devolvido por loginWithPassword quando
 * requirePasswordChange=true -- esse token nunca passa por saveTokens/
 * readTokens porque não é uma sessão completa (só autoriza esta chamada e
 * o logout).
 */
export async function firstAccessChangePassword(accessToken, newPassword, confirmPassword) {
  const response = await fetch(buildUrl("/api/auth/first-access/change-password"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ newPassword, confirmPassword })
  }).catch((error) => {
    throw new ClienteApiError(0, "NETWORK_ERROR", "Não foi possível conectar à API AcessaNet. Tente novamente.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = getErrorPayload(payload);
    throw new ClienteApiError(
      response.status,
      error.code || "REQUEST_FAILED",
      error.message || "Não foi possível concluir a alteração de senha.",
      error.details
    );
  }

  return payload;
}

/**
 * Alteração de senha "normal" (o cliente já sabe a senha atual). Não requer
 * estar autenticado no navegador: o backend valida CPF + senha atual
 * diretamente no SGP antes de aplicar a troca.
 */
export async function changePasswordWithCurrent({ cpf, currentPassword, newPassword, confirmPassword }) {
  return clienteRequest("/api/auth/change-password", {
    method: "POST",
    auth: false,
    body: {
      cpf: normalizeCpf(cpf),
      currentPassword,
      newPassword,
      confirmPassword
    }
  });
}

/** Encerra a sessão no backend (revoga o token). Funciona tanto para sessão completa quanto para a sessão restrita de primeiro acesso. */
export async function logoutCustomer(accessToken) {
  try {
    await fetch(buildUrl("/api/auth/logout"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });
  } catch {
    // Best-effort: mesmo se a chamada falhar, o token local ainda deve ser descartado pelo chamador.
  }
}

/** Validação de CPF no cliente, só para feedback imediato do formulário. O backend é sempre a fonte de verdade. */
export function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);
  const calc = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += digits[i] * (length + 1 - i);
    }
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  return calc(9) === digits[9] && calc(10) === digits[10];
}

const chatTokenCache = new Map();

export function clearChatTokenCache() {
  chatTokenCache.clear();
}

function isTokenExpiring(expiresAt) {
  const time = new Date(expiresAt).getTime();
  return Number.isNaN(time) || time - Date.now() < 30_000;
}

export async function getChatToken(contractId, ticketId) {
  const key = `${contractId || ""}:${ticketId || ""}`;
  const cached = chatTokenCache.get(key);

  if (cached && !isTokenExpiring(cached.expiresAt)) {
    return cached.chatToken;
  }

  const response = await clienteRequest("/api/auth/chat-token", {
    method: "POST",
    body: {
      ...(contractId ? { contractId } : {}),
      ...(ticketId ? { ticketId } : {})
    }
  });

  chatTokenCache.set(key, response);
  return response.chatToken;
}

export async function chatRequest(path, token, options = {}) {
  const { method = "GET", body } = options;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(buildUrl(path, getChatApiBaseUrl()), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    throw new ClienteApiError(
      0,
      "CHAT_NETWORK_ERROR",
      "Não foi possível conectar ao atendimento AcessaNet.",
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }

  if (response.status === 204) {
    return null;
  }

  let payload = null;
  let bodyIsUnparseableJson = false;
  try {
    payload = await response.json();
  } catch {
    bodyIsUnparseableJson = true;
  }

  if (!response.ok) {
    const error = getErrorPayload(payload);
    throw new ClienteApiError(
      response.status,
      error.code || "CHAT_REQUEST_FAILED",
      error.message || "Não foi possível acessar o atendimento.",
      error.details
    );
  }

  if (bodyIsUnparseableJson) {
    // Mesmo raciocinio do clienteRequest: 2xx com corpo que nao e JSON
    // valido nao e sucesso, e resposta inesperada (proxy/cache/hosting).
    throw new ClienteApiError(
      response.status,
      "CHAT_INVALID_RESPONSE",
      "A resposta do atendimento veio em um formato inesperado. Tente novamente.",
      undefined
    );
  }

  return payload;
}

export function normalizeCpf(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

export function maskCpf(value) {
  const digits = normalizeCpf(value);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/**
 * GET /api/central/network-status -- nunca expoe topologia/CTO/PON/OLT,
 * so o suficiente pra Central mostrar o aviso generico de instabilidade
 * regional. Ver server/src/routes/centralNetworkStatusRoutes.ts.
 */
export async function getNetworkStatus(contractId) {
  const query = contractId ? `?contractId=${encodeURIComponent(contractId)}` : "";
  return clienteRequest(`/api/central/network-status${query}`);
}

export async function listActiveNotices(contractId, signal) {
  const query = contractId ? `?contractId=${encodeURIComponent(contractId)}` : "";
  return clienteRequest(`/v1/notices/active${query}`, { signal });
}

export async function recordNoticeView(noticeId, contractId) {
  const query = contractId ? `?contractId=${encodeURIComponent(contractId)}` : "";
  return clienteRequest(`/v1/notices/${encodeURIComponent(noticeId)}/view${query}`, { method: "POST" });
}

export async function recordCentralActivity(input) {
  return clienteRequest("/v1/central/activity", {
    method: "POST",
    body: {
      eventType: input.eventType,
      page: input.page,
      ...(input.contractId ? { contractId: input.contractId } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {})
    }
  });
}

export async function createBugReport(input) {
  return clienteRequest("/api/bug-reports", {
    method: "POST",
    body: input
  });
}

/** Assinaturas eletronicas (SGPSign). Resposta sempre normalizada pelo backend -- ver server/src/signatures/signatureService.ts. */
export async function listContractSignatures(contractId, signal) {
  return clienteRequest(`/v1/contracts/${encodeURIComponent(contractId)}/signatures`, { signal });
}

/** Fire-and-forget: loga clique em "assinar agora"/abertura de documento. Nunca deve travar a navegacao se falhar. */
export async function logSignatureEvent(contractId, signatureId, event) {
  return clienteRequest(
    `/v1/contracts/${encodeURIComponent(contractId)}/signatures/${encodeURIComponent(signatureId)}/events`,
    { method: "POST", body: { event } }
  );
}

/** Promessa de pagamento / liberacao por confianca. Resposta sempre a tentativa real contra o SGP -- ver server/src/billing/paymentPromiseService.ts. */
export async function requestPaymentPromise(contractId) {
  return clienteRequest(`/v1/contracts/${encodeURIComponent(contractId)}/promise`, { method: "POST" });
}

/** Status da promessa mais recente (ainda ativa/recente) deste contrato, ou null se nao houver nenhuma. */
export async function getPaymentPromiseStatus(contractId, signal) {
  return clienteRequest(`/v1/contracts/${encodeURIComponent(contractId)}/promise`, { signal });
}

export function createClientMessageId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
