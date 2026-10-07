import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors.js";
import { redactSgpPayload } from "./redact.js";

export interface SgpContractRaw {
  [key: string]: unknown;
}

export interface SgpOccurrenceRaw {
  [key: string]: unknown;
}

export interface SgpInvoiceRaw {
  [key: string]: unknown;
}

/**
 * Client para a familia de API /api/ura/* do SGP (consulta cliente,
 * ocorrencias) mais /api/central/chamado/ (criacao de chamado). Reduzido em
 * relacao ao AcessaNet app: sem faturas (/api/ura/titulos/) nem ordens de
 * servico/agenda (/api/ura/ordemservico/*), fora de escopo por enquanto.
 */
export class SgpUraClient {
  private readonly tokenAuthFields: Record<string, string> | undefined;
  private readonly basicAuthorization: string | undefined;
  private readonly occurrenceCache = new Map<string, { expiresAt: number; value: SgpOccurrenceRaw[] }>();
  private readonly occurrenceRequests = new Map<string, Promise<SgpOccurrenceRaw[]>>();
  private readonly occurrenceCacheTtlMs = 3000;
  /**
   * Mesmo motivo do cache de ocorrencias acima: consultCustomerByContract e
   * chamado por mais de um provider (contratos e faturamento) dentro da
   * MESMA carga de pagina da Central -- sem isso, cada visita paga 2x a
   * latencia do SGP (medida em producao entre ~0.7s e ~4.5s por chamada,
   * ver server-out.log 2026-10-02) pelo EXATO mesmo dado. TTL curto de
   * proposito: o suficiente pra deduplicar a mesma carga de pagina, pequeno
   * demais pra servir plano/endereco desatualizado numa navegacao real.
   */
  private readonly contractCache = new Map<string, { expiresAt: number; value: SgpContractRaw[] }>();
  private readonly contractRequests = new Map<string, Promise<SgpContractRaw[]>>();
  private readonly contractCacheTtlMs = 3000;
  /**
   * Mesmo caso: listInvoicesByContract e chamado 2x por carga da Home --
   * uma vez embutido em SgpBackedBillingProvider.getBillingSummary (pro
   * calculo de maxDaysLate) e outra vez direto pela rota
   * /v1/contracts/:id/invoices (FaturasPage/ClienteHome). Sem cache, cada
   * visita paga a paginacao inteira de /api/ura/titulos/ duas vezes.
   */
  private readonly invoiceCache = new Map<string, { expiresAt: number; value: SgpInvoiceRaw[] }>();
  private readonly invoiceRequests = new Map<string, Promise<SgpInvoiceRaw[]>>();
  private readonly invoiceCacheTtlMs = 3000;

  constructor(private readonly config: AppConfig["sgp"]) {
    if (config.app && config.token) {
      this.tokenAuthFields = { app: config.app, token: config.token };
    }

    if (config.basicUsername && config.basicPassword) {
      this.basicAuthorization = `Basic ${Buffer.from(`${config.basicUsername}:${config.basicPassword}`).toString("base64")}`;
    }

    if (!this.tokenAuthFields && !this.basicAuthorization) {
      throw new AppError(500, "SGP_NOT_CONFIGURED", "Integracao SGP nao configurada.");
    }
  }

  async consultCustomerByContract(contractId: string) {
    const cached = this.contractCache.get(contractId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inFlight = this.contractRequests.get(contractId);
    if (inFlight) {
      return inFlight;
    }

    const request = this.postForm<{ contratos?: SgpContractRaw[] }>("/api/ura/consultacliente/", {
      contrato: contractId
    }).then((response) => {
      const contracts = Array.isArray(response.contratos) ? response.contratos : [];
      this.contractCache.set(contractId, { expiresAt: Date.now() + this.contractCacheTtlMs, value: contracts });
      return contracts;
    });

    this.contractRequests.set(contractId, request);

    try {
      return await request;
    } finally {
      this.contractRequests.delete(contractId);
    }
  }

  async consultCustomerByCpf(cpf: string) {
    const normalizedCpf = cpf.replace(/\D/g, "");
    const variants = buildCpfVariants(normalizedCpf);

    const endpoints = [
      { path: "/api/ura/clientes/", listKey: "clientes" as const },
      { path: "/api/ura/consultacliente/", listKey: "contratos" as const }
    ];

    for (const endpoint of endpoints) {
      for (const field of this.config.cpfSearchFields) {
        for (const variant of variants) {
          try {
            const response = await this.postForm<Record<string, unknown>>(endpoint.path, {
              [field]: variant
            });
            const contracts = normalizeSearchResponse(response, endpoint.listKey);
            if (contracts.length > 0) {
              return contracts;
            }
          } catch (error) {
            if (!isRecoverableSearchFieldError(error)) {
              throw error;
            }
          }
        }
      }
    }

    return [];
  }

  async listInvoicesByContract(contractId: string) {
    const cached = this.invoiceCache.get(contractId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inFlight = this.invoiceRequests.get(contractId);
    if (inFlight) {
      return inFlight;
    }

    const request = this.fetchInvoicesByContract(contractId).then((invoices) => {
      this.invoiceCache.set(contractId, { expiresAt: Date.now() + this.invoiceCacheTtlMs, value: invoices });
      return invoices;
    });

    this.invoiceRequests.set(contractId, request);

    try {
      return await request;
    } finally {
      this.invoiceRequests.delete(contractId);
    }
  }

  private async fetchInvoicesByContract(contractId: string) {
    const invoices: SgpInvoiceRaw[] = [];
    const limit = 250;
    let offset = 0;

    for (let page = 0; page < 100; page += 1) {
      const response = await this.postForm<{
        titulos?: SgpInvoiceRaw[];
        paginacao?: { total?: number; parcial?: number };
      }>("/api/ura/titulos/", {
        contrato: contractId,
        offset: String(offset),
        limit: String(limit)
      });
      const pageInvoices = Array.isArray(response.titulos) ? response.titulos : [];
      invoices.push(...pageInvoices);

      const total = Number(response.paginacao?.total);
      if (pageInvoices.length === 0 || (Number.isFinite(total) && invoices.length >= total) || pageInvoices.length < limit) {
        break;
      }

      offset += pageInvoices.length;
    }

    return invoices;
  }

  async listOccurrencesByContract(contractId: string) {
    const cached = this.occurrenceCache.get(contractId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inFlight = this.occurrenceRequests.get(contractId);
    if (inFlight) {
      return inFlight;
    }

    const request = this.postForm<{ ocorrencias?: SgpOccurrenceRaw[] }>("/api/ura/ocorrencia/list/", {
      contrato: contractId
    }).then((response) => {
      const occurrences = Array.isArray(response.ocorrencias) ? response.ocorrencias : [];
      this.occurrenceCache.set(contractId, {
        expiresAt: Date.now() + this.occurrenceCacheTtlMs,
        value: occurrences
      });
      return occurrences;
    });

    this.occurrenceRequests.set(contractId, request);

    try {
      return await request;
    } finally {
      this.occurrenceRequests.delete(contractId);
    }
  }

  /**
   * POST /api/central/chamado/ -- familia de API diferente de /api/ura/*:
   * autentica SO com token+app no corpo (nunca Basic Auth, nunca retry).
   * Validado sob demanda (nao no construtor) para nao derrubar o cliente
   * inteiro -- e as demais chamadas /api/ura/* que ja funcionam -- so
   * porque a criacao de chamado ainda nao foi configurada.
   */
  async createCentralChamado(input: {
    contrato: string;
    conteudo: string;
    contato?: string | undefined;
    contatoNumero?: string | undefined;
    ocorrenciaTipo: string;
    motivoOs: string;
    semOs?: string | undefined;
  }): Promise<{ sgpTicketId: string; protocol: string; rawStatus: string; raw: Record<string, unknown> }> {
    const app = this.config.chamado.app;
    const token = this.config.chamado.token;
    if (!app || !token) {
      throw new AppError(500, "SGP_CHAMADO_NOT_CONFIGURED", "Integracao de abertura de chamado no SGP nao configurada.");
    }

    const fields: Record<string, string> = {
      token,
      app,
      contrato: input.contrato,
      conteudo: input.conteudo,
      ocorrenciatipo: input.ocorrenciaTipo,
      motivoos: input.motivoOs
    };

    if (input.contato) {
      fields.contato = input.contato;
    }
    if (input.contatoNumero) {
      fields.contato_numero = input.contatoNumero;
    }
    if (input.semOs) {
      fields.sem_os = input.semOs;
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      params.append(key, value);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.chamado.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/api/central/chamado/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: controller.signal
      });
    } catch {
      throw new AppError(502, "SGP_CHAMADO_REQUEST_FAILED", "Nao foi possivel abrir o chamado no SGP agora.");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new AppError(502, "SGP_CHAMADO_REQUEST_FAILED", "Nao foi possivel abrir o chamado no SGP agora.", {
        upstreamStatus: response.status
      });
    }

    let raw: Record<string, unknown>;
    try {
      raw = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new AppError(502, "SGP_CHAMADO_REQUEST_FAILED", "Resposta invalida do SGP ao abrir o chamado.");
    }

    return {
      sgpTicketId: pickString(raw, ["id", "id_chamado", "chamado_id", "os", "id_os", "numero", "protocolo"]) || `sgp_chamado_${Date.now()}`,
      protocol: pickString(raw, ["protocolo", "protocol", "numero", "id"]) || "",
      rawStatus: pickString(raw, ["status", "status_descricao", "situacao"]) || "aberto",
      raw: redactSgpPayload(raw) as Record<string, unknown>
    };
  }

  /**
   * POST /api/ura/liberacaopromessa/ -- "promessa de pagamento" / "liberacao
   * por confianca". Nao documentado nos manuais publicos do SGP (bookstack/
   * wiki); o path e o verbo foram confirmados de forma independente numa
   * integracao real de terceiro com o mesmo SGP (PR publico
   * tavaresbr/genieacs-panel#156, que corrigiu de "/api/ura/liberacao/"
   * -- invalido -- para este path). Mesma familia de auth de
   * consultCustomerByContract/listOccurrencesByContract (postForm), nenhuma
   * credencial nova. Nomes de campo da resposta tambem vem dessa mesma
   * integracao de terceiro, nao de doc oficial -- por isso o fallback
   * tolerante de nomes abaixo, igual ao resto deste arquivo/sgpMapper.ts.
   */
  async requestPaymentPromise(contractId: string): Promise<{
    released: boolean;
    protocol: string;
    releasedDays: number | undefined;
    message: string;
    raw: Record<string, unknown>;
  }> {
    const raw = await this.postForm<Record<string, unknown>>("/api/ura/liberacaopromessa/", {
      contrato: contractId
    });

    const releasedRaw = pickString(raw, ["liberado", "released", "sucesso", "success"]).trim().toLowerCase();
    const released = releasedRaw.length > 0 && !["0", "false", "nao", "não", "n", "failed", "erro"].includes(releasedRaw);

    const releasedDaysText = pickString(raw, ["liberado_dias", "liberadoDias", "dias", "dias_liberados", "diasLiberados"]);
    const releasedDays = releasedDaysText ? Number(releasedDaysText) : undefined;

    return {
      released,
      protocol: pickString(raw, ["protocolo", "protocol", "numero", "id"]),
      releasedDays: Number.isFinite(releasedDays) ? releasedDays : undefined,
      message: pickString(raw, ["mensagem", "msg", "message", "motivo", "descricao"]),
      raw: redactSgpPayload(raw) as Record<string, unknown>
    };
  }

  private async postForm<T>(path: string, fields: Record<string, string>): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      params.append(key, value);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      let response: Response;

      if (this.basicAuthorization) {
        response = await fetch(`${this.config.baseUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: this.basicAuthorization
          },
          body: params.toString(),
          signal: controller.signal
        });
      } else {
        response = await fetch(`${this.config.baseUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
          signal: controller.signal
        });
      }

      if (!response.ok && (response.status === 401 || response.status === 403) && this.tokenAuthFields) {
        const tokenParams = new URLSearchParams();
        for (const [key, value] of Object.entries({ ...this.tokenAuthFields, ...fields })) {
          tokenParams.append(key, value);
        }
        response = await fetch(`${this.config.baseUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString(),
          signal: controller.signal
        });
      }

      if (!response.ok) {
        throw new AppError(502, "SGP_REQUEST_FAILED", "Nao foi possivel consultar o SGP agora.", {
          upstreamStatus: response.status
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(502, "SGP_REQUEST_FAILED", "Nao foi possivel consultar o SGP agora.");
    } finally {
      clearTimeout(timer);
    }
  }
}

function isRecoverableSearchFieldError(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return false;
  }

  const upstreamStatus =
    error.details && typeof error.details === "object" && "upstreamStatus" in error.details
      ? Number((error.details as Record<string, unknown>).upstreamStatus)
      : 0;

  return upstreamStatus === 400 || upstreamStatus === 422;
}

function normalizeSearchResponse(response: Record<string, unknown>, listKey: "clientes" | "contratos") {
  const value = response[listKey];
  if (Array.isArray(value)) {
    return value as SgpContractRaw[];
  }

  if (value && typeof value === "object" && "items" in value && Array.isArray((value as { items?: unknown[] }).items)) {
    return (value as { items: SgpContractRaw[] }).items;
  }

  return [];
}

function pickString(record: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function buildCpfVariants(digits: string): string[] {
  if (digits.length !== 11) {
    return [digits];
  }

  const formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  return [formatted, digits];
}
