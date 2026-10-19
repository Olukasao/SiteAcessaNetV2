import { AppError } from "../errors.js";
import type { BillingProvider, PaymentPromiseResult } from "../integrations/sgp/providers.js";
import type { CentralActivityService } from "../analytics/centralActivityService.js";
import type { InMemoryRateLimiter, RateLimitRule } from "../auth/rateLimiter.js";
import type { ContractSummary } from "../types.js";

const DEFAULT_RATE_LIMIT: RateLimitRule = { limit: 1, windowMs: 30_000 };

/** Janela dentro da qual uma promessa bem-sucedida ainda conta como "ativa/recente" pro card da seção 14 -- nunca calcula uma data de expiracao real (o SGP nem sempre informa quantos dias foram liberados), so limita ha quanto tempo olhamos pra tras. */
const PROMISE_STATUS_LOOKBACK_DAYS = 30;

export interface PaymentPromiseOutcome {
  released: boolean;
  protocol: string | undefined;
  releasedDays: number | undefined;
  message: string;
}

export interface PaymentPromiseStatus {
  requestedAt: string;
  protocol: string | null;
  releasedDays: number | null;
}

export class PaymentPromiseService {
  /** Mesmo padrao de SupportService.inFlightTicketCreations: cobre a janela de corrida DURANTE o round-trip ao SGP. So funciona em processo unico -- ver mesma ressalva la. */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly billingProvider: BillingProvider,
    private readonly centralActivityService: CentralActivityService,
    private readonly rateLimiter: InMemoryRateLimiter,
    private readonly rateLimitRule: RateLimitRule = DEFAULT_RATE_LIMIT
  ) {}

  async requestPromise(contract: ContractSummary): Promise<PaymentPromiseOutcome> {
    const key = `promise:${contract.id}`;

    /** So protege contra clique duplo/spam -- a regra real de elegibilidade (quantas promessas por mes, etc.) e 100% do SGP, nunca duplicada aqui. */
    this.rateLimiter.consume(key, this.rateLimitRule);

    if (this.inFlight.has(key)) {
      throw new AppError(
        409,
        "PROMISE_IN_PROGRESS",
        "Ja existe uma solicitacao de promessa de pagamento em andamento para este contrato."
      );
    }
    this.inFlight.add(key);

    try {
      const result = await this.billingProvider.requestPaymentPromise(contract);
      return {
        released: result.released,
        protocol: result.protocol || undefined,
        releasedDays: result.releasedDays,
        message: friendlyMessage(result)
      };
    } finally {
      this.inFlight.delete(key);
    }
  }

  async getStatus(contractId: string): Promise<PaymentPromiseStatus | null> {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - PROMISE_STATUS_LOOKBACK_DAYS);

    const result = await this.centralActivityService.listActivity({
      range: { from, to },
      page: 1,
      limit: 1,
      eventType: "REQUEST_PAYMENT_PROMISE",
      contractId,
      order: "desc"
    });

    const latest = result.items[0];
    /** So mostra o card quando a ultima tentativa registrada foi liberada de verdade -- uma tentativa recusada nunca aparece como "promessa ativa". */
    if (!latest || latest.metadata?.released !== true) {
      return null;
    }

    const releasedDays = latest.metadata?.releasedDays;
    return {
      requestedAt: latest.createdAt.toISOString(),
      protocol: typeof latest.metadata?.protocol === "string" && latest.metadata.protocol ? latest.metadata.protocol : null,
      releasedDays: typeof releasedDays === "number" ? releasedDays : null
    };
  }
}

/**
 * Traduz a mensagem de negocio do SGP (texto livre, nomes de campo nao confirmados por doc
 * oficial -- ver sgpClient.ts#requestPaymentPromise) pras categorias pedidas na secao 11,
 * por palavra-chave (mesmo estilo de integrations/sgp/statusMapper.ts). Nunca devolve o
 * texto cru do SGP sem passar por aqui.
 */
function friendlyMessage(result: PaymentPromiseResult): string {
  if (result.released) {
    return "Promessa de pagamento realizada com sucesso.";
  }

  const normalized = normalizeText(result.message);
  const fallback = "No momento este contrato nao esta elegivel para uma nova promessa de pagamento.";

  if (!normalized) {
    return fallback;
  }

  if (normalized.includes("ja possui") || normalized.includes("ja existe") || normalized.includes("ja tem") || normalized.includes("ativa")) {
    return "Voce ja possui uma promessa de pagamento ativa para este contrato.";
  }

  if (normalized.includes("limite")) {
    return "O limite de promessas de pagamento deste mes ja foi atingido para este contrato.";
  }

  if (normalized.includes("cancel")) {
    return "Este contrato esta cancelado e nao pode usar a promessa de pagamento.";
  }

  if (normalized.includes("suspens") || normalized.includes("bloq")) {
    return "Este contrato esta suspenso e a promessa de pagamento nao esta disponivel no momento.";
  }

  return fallback;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
