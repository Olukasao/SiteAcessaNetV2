import { describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "../src/repositories/inMemoryStore.js";
import { SignatureService } from "../src/signatures/signatureService.js";
import { UnavailableSignatureProvider, type SignatureProvider } from "../src/integrations/sgp/providers.js";
import { AppError } from "../src/errors.js";

function seedContract(store: InMemoryStore, customerId: string, contractId: string) {
  store.upsertCustomer({ id: customerId, name: "Cliente", cpf: "12345678909", phone: "11987654321" });
  return store.upsertContract({
    id: contractId,
    customerId,
    addressLine: "Rua Teste",
    city: "Franco da Rocha",
    state: "SP",
    planName: "800 Mega",
    status: "ACTIVE"
  });
}

describe("SignatureService.listSignatures", () => {
  it("nunca expoe assinatura de contrato de outro cliente (404 generico)", async () => {
    const store = new InMemoryStore();
    seedContract(store, "customer_a", "contract_a");
    const provider = new UnavailableSignatureProvider();
    const service = new SignatureService(store, provider);

    await expect(service.listSignatures("customer_b", "contract_a")).rejects.toMatchObject({
      statusCode: 404,
      code: "RESOURCE_NOT_FOUND"
    });
  });

  it("devolve source:unavailable quando o provider nao consegue consultar o SGP, nunca uma lista vazia disfarcada de 'sem pendencias'", async () => {
    const store = new InMemoryStore();
    const contract = seedContract(store, "customer_a", "contract_a");
    const provider = new UnavailableSignatureProvider();
    const service = new SignatureService(store, provider);

    const result = await service.listSignatures(contract.customerId, contract.id);

    expect(result.source).toBe("unavailable");
    expect(result.signatures).toEqual([]);
  });
});

describe("SignatureService.recordEvent", () => {
  it("rejeita signatureId que nao pertence a lista mais recente do contrato (mitigacao de IDOR)", async () => {
    const store = new InMemoryStore();
    const contract = seedContract(store, "customer_a", "contract_a");
    const provider: SignatureProvider = {
      listSignatures: vi.fn().mockResolvedValue({
        source: "mock",
        signatures: [
          {
            id: "sig_real",
            contractId: contract.id,
            title: "Contrato",
            status: "pending",
            statusLabel: "Assinatura pendente",
            createdAt: undefined,
            signedAt: undefined,
            signUrl: undefined,
            documentUrl: undefined,
            signKey: undefined
          }
        ]
      })
    };
    const service = new SignatureService(store, provider);

    await expect(
      service.recordEvent(contract.customerId, contract.id, "sig_de_outro_contrato", "sign_redirect")
    ).rejects.toMatchObject({ statusCode: 404, code: "RESOURCE_NOT_FOUND" });
  });

  it("aceita o evento quando signatureId pertence a lista do contrato do cliente autenticado", async () => {
    const store = new InMemoryStore();
    const contract = seedContract(store, "customer_a", "contract_a");
    const provider: SignatureProvider = {
      listSignatures: vi.fn().mockResolvedValue({
        source: "mock",
        signatures: [
          {
            id: "sig_real",
            contractId: contract.id,
            title: "Contrato",
            status: "pending",
            statusLabel: "Assinatura pendente",
            createdAt: undefined,
            signedAt: undefined,
            signUrl: undefined,
            documentUrl: undefined,
            signKey: undefined
          }
        ]
      })
    };
    const service = new SignatureService(store, provider);

    await expect(
      service.recordEvent(contract.customerId, contract.id, "sig_real", "sign_redirect")
    ).resolves.toBeUndefined();
  });

  it("nunca permite revalidar contrato de outro cliente mesmo com signatureId correto", async () => {
    const store = new InMemoryStore();
    const contract = seedContract(store, "customer_a", "contract_a");
    const provider: SignatureProvider = { listSignatures: vi.fn() };
    const service = new SignatureService(store, provider);

    await expect(
      service.recordEvent("customer_b", contract.id, "sig_real", "sign_redirect")
    ).rejects.toBeInstanceOf(AppError);
    expect(provider.listSignatures).not.toHaveBeenCalled();
  });
});
