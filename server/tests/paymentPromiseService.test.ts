import { describe, expect, it, vi } from "vitest";
import { createDatabase } from "../src/repositories/sqlite.js";
import { SqliteCentralActivityRepository } from "../src/repositories/centralActivityRepository.js";
import { CentralActivityService } from "../src/analytics/centralActivityService.js";
import { InMemoryStore } from "../src/repositories/inMemoryStore.js";
import { InMemoryRateLimiter } from "../src/auth/rateLimiter.js";
import { PaymentPromiseService } from "../src/billing/paymentPromiseService.js";
import type { BillingProvider, PaymentPromiseResult } from "../src/integrations/sgp/providers.js";
import type { AuthProfileRepository } from "../src/repositories/authProfileRepository.js";
import type { ContractSummary } from "../src/types.js";

function buildCentralActivityService() {
  const repo = new SqliteCentralActivityRepository(createDatabase(":memory:"));
  // listActivity (o unico metodo usado por PaymentPromiseService.getStatus) nunca toca authProfiles/store.
  const authProfiles = {} as AuthProfileRepository;
  return { repo, service: new CentralActivityService(repo, authProfiles, new InMemoryStore()) };
}

function contract(overrides: Partial<ContractSummary> = {}): ContractSummary {
  return {
    id: "contract_1",
    customerId: "customer_1",
    addressLine: "Rua X",
    city: "Franco da Rocha",
    state: "SP",
    planName: "500 Mega",
    status: "ACTIVE",
    ...overrides
  };
}

function billingProvider(result: PaymentPromiseResult | (() => Promise<PaymentPromiseResult>)): BillingProvider {
  return {
    getBillingSummary: vi.fn(),
    listInvoices: vi.fn(),
    requestPaymentPromise: vi.fn(typeof result === "function" ? result : async () => result)
  };
}

describe("PaymentPromiseService", () => {
  it("em sucesso, devolve protocolo/dias e grava evento liberado", async () => {
    const { service } = buildCentralActivityService();
    const provider = billingProvider({
      released: true,
      protocol: "200429143108",
      releasedDays: 1,
      message: "",
      raw: {}
    });
    const promiseService = new PaymentPromiseService(provider, service, new InMemoryRateLimiter());

    const outcome = await promiseService.requestPromise(contract());

    expect(outcome.released).toBe(true);
    expect(outcome.protocol).toBe("200429143108");
    expect(outcome.releasedDays).toBe(1);
    expect(outcome.message).toBe("Promessa de pagamento realizada com sucesso.");
  });

  it("traduz recusa de negocio (promessa ja ativa) sem expor o texto cru do SGP", async () => {
    const { service } = buildCentralActivityService();
    const provider = billingProvider({
      released: false,
      protocol: "",
      releasedDays: undefined,
      message: "Contrato ja possui promessa ativa",
      raw: {}
    });
    const promiseService = new PaymentPromiseService(provider, service, new InMemoryRateLimiter());

    const outcome = await promiseService.requestPromise(contract());

    expect(outcome.released).toBe(false);
    expect(outcome.message).toBe("Voce ja possui uma promessa de pagamento ativa para este contrato.");
    expect(outcome.message).not.toContain("Contrato ja possui promessa ativa");
  });

  it("recusa generica (sem palavra-chave reconhecida) cai no fallback amigavel", async () => {
    const { service } = buildCentralActivityService();
    const provider = billingProvider({
      released: false,
      protocol: "",
      releasedDays: undefined,
      message: "ERR_9981_XYZ",
      raw: {}
    });
    const promiseService = new PaymentPromiseService(provider, service, new InMemoryRateLimiter());

    const outcome = await promiseService.requestPromise(contract());

    expect(outcome.message).not.toContain("ERR_9981_XYZ");
    expect(outcome.message).toContain("nao esta elegivel");
  });

  it("propaga erro de transporte do SGP sem mascarar como recusa de negocio", async () => {
    const { service } = buildCentralActivityService();
    const provider: BillingProvider = {
      getBillingSummary: vi.fn(),
      listInvoices: vi.fn(),
      requestPaymentPromise: vi.fn().mockRejectedValue(Object.assign(new Error("SGP down"), { statusCode: 502, code: "SGP_REQUEST_FAILED" }))
    };
    const promiseService = new PaymentPromiseService(provider, service, new InMemoryRateLimiter());

    await expect(promiseService.requestPromise(contract())).rejects.toMatchObject({ code: "SGP_REQUEST_FAILED" });
  });

  it("bloqueia uma segunda solicitacao concorrente pro MESMO contrato (lock em memoria)", async () => {
    const { service } = buildCentralActivityService();
    let resolveFirst: (() => void) | undefined;
    const provider = billingProvider(
      () =>
        new Promise<PaymentPromiseResult>((resolve) => {
          resolveFirst = () => resolve({ released: true, protocol: "p1", releasedDays: 1, message: "", raw: {} });
        })
    );
    // rate limit permissivo de proposito -- este teste isola o LOCK em memoria, nao o rate limit (testado a parte abaixo).
    const promiseService = new PaymentPromiseService(provider, service, new InMemoryRateLimiter(), { limit: 10, windowMs: 30_000 });

    const first = promiseService.requestPromise(contract());
    await expect(promiseService.requestPromise(contract())).rejects.toMatchObject({ code: "PROMISE_IN_PROGRESS" });

    resolveFirst?.();
    await expect(first).resolves.toMatchObject({ released: true });
  });

  it("aplica rate limit: segunda tentativa logo em seguida (apos a primeira terminar) e bloqueada", async () => {
    const { service } = buildCentralActivityService();
    const provider = billingProvider({ released: false, protocol: "", releasedDays: undefined, message: "", raw: {} });
    const promiseService = new PaymentPromiseService(provider, service, new InMemoryRateLimiter());

    await promiseService.requestPromise(contract());
    await expect(promiseService.requestPromise(contract())).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("isolamento: getStatus de um contrato nunca devolve a promessa de outro contrato/cliente", async () => {
    const { repo, service } = buildCentralActivityService();

    await repo.record({
      sessionId: "s_a",
      customerId: "customer_a",
      cpfHash: "hash_a",
      contractId: "contract_a",
      eventType: "REQUEST_PAYMENT_PROMISE",
      page: "faturas",
      metadata: { released: true, protocol: "proto-a", releasedDays: 2 }
    });
    await repo.record({
      sessionId: "s_b",
      customerId: "customer_b",
      cpfHash: "hash_b",
      contractId: "contract_b",
      eventType: "REQUEST_PAYMENT_PROMISE",
      page: "faturas",
      metadata: { released: true, protocol: "proto-b", releasedDays: 5 }
    });

    const provider = billingProvider({ released: false, protocol: "", releasedDays: undefined, message: "", raw: {} });
    const promiseService = new PaymentPromiseService(provider, service, new InMemoryRateLimiter());

    const statusA = await promiseService.getStatus("contract_a");
    const statusB = await promiseService.getStatus("contract_b");

    expect(statusA?.protocol).toBe("proto-a");
    expect(statusA?.releasedDays).toBe(2);
    expect(statusB?.protocol).toBe("proto-b");
    expect(statusB?.releasedDays).toBe(5);
  });

  it("getStatus nunca mostra card pra uma tentativa recusada (released: false)", async () => {
    const { repo, service } = buildCentralActivityService();
    await repo.record({
      sessionId: "s_c",
      customerId: "customer_c",
      cpfHash: "hash_c",
      contractId: "contract_c",
      eventType: "REQUEST_PAYMENT_PROMISE",
      page: "faturas",
      metadata: { released: false, message: "nao elegivel" }
    });

    const provider = billingProvider({ released: false, protocol: "", releasedDays: undefined, message: "", raw: {} });
    const promiseService = new PaymentPromiseService(provider, service, new InMemoryRateLimiter());

    expect(await promiseService.getStatus("contract_c")).toBeNull();
  });
});
