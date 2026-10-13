import { AppError } from "../../errors.js";

export interface AcessanetConnectClientConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export interface MarketingLead {
  visitorId: string;
  fullName: string;
  email: string;
  phone: string;
  establishment: string | null;
  registeredAt: string;
  marketingConsentAt: string;
}

/**
 * Client somente-leitura para o backend do AcessaNet Connect (captive portal Wi-Fi,
 * repo separado em /home/noc/roteador-publico/apps/api). Mesmo espirito do
 * oltCloudClient.ts: so GET, token fixo de servico (nao e sessao de admin), nunca
 * expor aqui nenhum metodo de escrita.
 */
export class AcessanetConnectClient {
  constructor(private readonly config: AcessanetConnectClientConfig) {
    if (!config.baseUrl || !config.token) {
      throw new AppError(500, "ACESSANET_CONNECT_NOT_CONFIGURED", "Integracao com o AcessaNet Connect nao configurada.");
    }
  }

  async listMarketingLeads(): Promise<MarketingLead[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/internal/marketing-leads`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.config.token}` },
        signal: controller.signal
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new AppError(
        502,
        aborted ? "ACESSANET_CONNECT_TIMEOUT" : "ACESSANET_CONNECT_REQUEST_FAILED",
        aborted ? "Tempo limite ao consultar o AcessaNet Connect." : "Nao foi possivel consultar o AcessaNet Connect agora."
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new AppError(502, "ACESSANET_CONNECT_UPSTREAM_ERROR", "Erro ao consultar o AcessaNet Connect.", {
        upstreamStatus: response.status
      });
    }

    try {
      return (await response.json()) as MarketingLead[];
    } catch {
      throw new AppError(502, "ACESSANET_CONNECT_INVALID_RESPONSE", "Resposta invalida do AcessaNet Connect.");
    }
  }
}
