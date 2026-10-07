import { AppError } from "../../errors.js";

export interface OltCloudClientConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export interface OltCloudRequestLogEntry {
  timestamp: string;
  endpoint: string;
  durationMs: number;
  status: number | null;
  ok: boolean;
}

export type OltCloudLogger = (entry: OltCloudRequestLogEntry) => void;

/** page_size enviado em equipment/list -- alto o suficiente pra reduzir chamadas, dentro do que a API aceitar. */
const EQUIPMENT_PAGE_SIZE = 1000;
/** Guarda de seguranca contra loop infinito de paginacao (next apontando pra si mesmo, bug na API, etc). */
const MAX_EQUIPMENT_PAGES = 500;

/**
 * Client somente-leitura para a API da OLT Cloud (https://api.oltcloud.co/).
 * So GET -- nunca expor metodo que permita POST/PUT/PATCH/DELETE aqui.
 * Qualquer operacao de escrita (confirm/ignore/reactivate/etc) fica fora
 * de escopo deste client ate uma decisao explicita de integrar de verdade.
 */
export class OltCloudClient {
  constructor(
    private readonly config: OltCloudClientConfig,
    private readonly logger: OltCloudLogger = () => {}
  ) {
    if (!config.baseUrl || !config.token) {
      throw new AppError(500, "OLTCLOUD_NOT_CONFIGURED", "Integracao OLT Cloud nao configurada.");
    }
  }

  async listAlerts(): Promise<Record<string, unknown>[]> {
    const response = await this.get<unknown>("/api/v2/ftth/alert/list");
    return normalizeList(response, ["data", "alerts", "items", "results"]);
  }

  async getClientDeviceAlert(query: {
    id?: string | undefined;
    pppoe?: string | undefined;
    document?: string | undefined;
    external_id?: string | undefined;
    external_contract_id?: string | undefined;
  }): Promise<Record<string, unknown>> {
    const params = buildParams(query);
    const response = await this.get<unknown>(`/api/v2/client/device_alert${params ? `?${params}` : ""}`);
    return (response && typeof response === "object" ? (response as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >;
  }

  /**
   * equipment/list pode ser paginado -- NUNCA assumir que a primeira pagina
   * contem todos os equipamentos da PON (ver secao 6 do pedido de deteccao
   * de queda massiva). Busca page_size alto e segue por "next" (URL
   * absoluta/relativa OU numero de proxima pagina, dependendo do que a API
   * devolver) ate ele vir vazio/ausente ou ate a guarda de seguranca.
   */
  async listEquipment(filters: {
    client_id?: string | undefined;
    client_pppoe?: string | undefined;
    external_client_id?: string | undefined;
    external_client_contract_id?: string | undefined;
    olt_id?: string | undefined;
    slot?: string | undefined;
    pon?: string | undefined;
    pon_id?: string | undefined;
    status?: string | undefined;
    last_status_update?: string | undefined;
    last_disconnection?: string | undefined;
  }): Promise<Record<string, unknown>[]> {
    return this.getAllPages("/api/v2/ftth/equipment/list", filters, ["data", "equipment", "items", "results"]);
  }

  async getEquipmentRealtime(filters: {
    olt_id?: string | undefined;
    slot?: string | undefined;
    pon?: string | undefined;
  }): Promise<unknown> {
    const params = buildParams(filters);
    return this.get<unknown>(`/api/v2/ftth/equipment/realtime${params ? `?${params}` : ""}`);
  }

  /**
   * Busca todas as paginas de uma lista, nunca confiando que a primeira
   * pagina contem tudo. Pagina 1 usa os filtros + page_size alto; se a
   * resposta trouxer "next" (string = URL absoluta/relativa pra proxima
   * pagina, numero = indice da proxima pagina), continua buscando e junta
   * tudo. Para quando "next" vier vazio/ausente, ou ao bater a guarda de
   * seguranca (MAX_EQUIPMENT_PAGES) -- o que evita loop infinito se a API
   * devolver um "next" invalido/repetido.
   */
  private async getAllPages(
    basePath: string,
    filters: Record<string, string | undefined>,
    listKeys: string[]
  ): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = [];
    let nextUrl: string | undefined;
    let page = 1;

    for (let i = 0; i < MAX_EQUIPMENT_PAGES; i++) {
      const response = nextUrl
        ? await this.getByUrlOrPath(nextUrl)
        : await this.get<unknown>(
            `${basePath}?${buildParams({ ...filters, page_size: String(EQUIPMENT_PAGE_SIZE), page: page > 1 ? String(page) : undefined })}`
          );

      results.push(...normalizeList(response, listKeys));

      const next = extractNext(response);
      if (next === undefined) {
        break;
      }

      if (typeof next === "string") {
        nextUrl = next;
        page += 1;
      } else {
        if (next === page) {
          break;
        }
        page = next;
        nextUrl = undefined;
      }
    }

    return results;
  }

  private async getByUrlOrPath(next: string): Promise<unknown> {
    if (/^https?:\/\//i.test(next)) {
      return this.request<unknown>(next, next);
    }
    const path = next.startsWith("/") ? next : `/${next}`;
    return this.request<unknown>(`${this.config.baseUrl}${path}`, path);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(`${this.config.baseUrl}${path}`, path);
  }

  private async request<T>(url: string, path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const startedAt = Date.now();
    const timestamp = new Date().toISOString();

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      const aborted = error instanceof Error && error.name === "AbortError";
      this.logger({ timestamp, endpoint: path, durationMs, status: null, ok: false });
      throw new AppError(
        502,
        aborted ? "OLTCLOUD_TIMEOUT" : "OLTCLOUD_REQUEST_FAILED",
        aborted ? "Tempo limite ao consultar a OLT Cloud." : "Nao foi possivel consultar a OLT Cloud agora."
      );
    }
    clearTimeout(timer);

    const durationMs = Date.now() - startedAt;
    this.logger({ timestamp, endpoint: path, durationMs, status: response.status, ok: response.ok });

    if (response.status === 401) {
      throw new AppError(502, "OLTCLOUD_UNAUTHORIZED", "Token OLT Cloud invalido ou expirado.", { path });
    }
    if (response.status === 403) {
      throw new AppError(502, "OLTCLOUD_FORBIDDEN", "Usuario OLT Cloud sem permissao para este recurso.", { path });
    }
    if (response.status >= 500) {
      throw new AppError(502, "OLTCLOUD_UPSTREAM_ERROR", "Erro na API da OLT Cloud.", {
        path,
        upstreamStatus: response.status
      });
    }
    if (!response.ok) {
      throw new AppError(502, "OLTCLOUD_REQUEST_FAILED", "Nao foi possivel consultar a OLT Cloud agora.", {
        path,
        upstreamStatus: response.status
      });
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new AppError(502, "OLTCLOUD_INVALID_RESPONSE", "Resposta invalida da OLT Cloud.", { path });
    }
  }
}

function buildParams(fields: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value) {
      params.set(key, value);
    }
  }
  return params.toString();
}

/** Le o campo "next" de uma resposta paginada -- string (URL/caminho) ou numero (proxima pagina). undefined = sem proxima pagina. */
function extractNext(response: unknown): string | number | undefined {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return undefined;
  }
  const next = (response as Record<string, unknown>).next;
  if (typeof next === "string" && next.trim()) {
    return next.trim();
  }
  if (typeof next === "number" && Number.isFinite(next)) {
    return next;
  }
  return undefined;
}

function normalizeList(response: unknown, listKeys: string[]): Record<string, unknown>[] {
  if (Array.isArray(response)) {
    return response as Record<string, unknown>[];
  }

  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    for (const key of listKeys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value as Record<string, unknown>[];
      }
    }
  }

  return [];
}
