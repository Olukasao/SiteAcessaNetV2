import { describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "../src/repositories/inMemoryStore.js";
import { OwnershipService } from "../src/security/ownership.js";
import { AppError } from "../src/errors.js";
import { sha256 } from "../src/security/hash.js";

/**
 * Teste de isolamento multiusuario (P0): InMemoryStore e um Map compartilhado
 * por TODO o processo (um unico container, ver createContainer em
 * container.ts) -- toda requisicao de todo cliente passa pelo mesmo Map de
 * contratos. Esse teste simula exatamente essa forma, com dois clientes
 * distintos (A e B) resolvidos em sequencia (como acontece quando dois
 * logins diferentes acontecem no mesmo processo Node), e confirma que
 * OwnershipService nunca deixa o cliente A acessar um contrato do cliente B,
 * mesmo os dois vivendo no MESMO Map compartilhado.
 */
describe("OwnershipService (isolamento cross-tenant)", () => {
  function buildTwoCustomersStore() {
    const store = new InMemoryStore();

    const customerA = store.upsertCustomer({
      id: "customer_sgp_aaaa",
      name: "Cliente A",
      cpf: "39581323830",
      phone: "11999990000"
    });
    const customerB = store.upsertCustomer({
      id: "customer_sgp_bbbb",
      name: "Cliente B",
      cpf: "41882797884",
      phone: "11999991111"
    });

    const contractA = store.upsertContract({
      id: "18277",
      customerId: customerA.id,
      addressLine: "Rua A, 100",
      city: "Cidade A",
      state: "SP",
      planName: "Plano A",
      status: "ACTIVE"
    });
    const contractB = store.upsertContract({
      id: "26983",
      customerId: customerB.id,
      addressLine: "Rua B, 200",
      city: "Cidade B",
      state: "SP",
      planName: "Plano B",
      status: "ACTIVE"
    });

    return { store, customerA, customerB, contractA, contractB };
  }

  it("permite que o cliente A acesse o proprio contrato", async () => {
    const { store, customerA, contractA } = buildTwoCustomersStore();
    const ownership = new OwnershipService(store);

    await expect(ownership.assertContract(customerA.id, contractA.id)).resolves.toEqual(contractA);
  });

  it("BLOQUEIA o cliente A tentando acessar o contrato do cliente B (manipulacao manual de contractId)", async () => {
    const { store, customerA, contractB } = buildTwoCustomersStore();
    const ownership = new OwnershipService(store);

    await expect(ownership.assertContract(customerA.id, contractB.id)).rejects.toBeInstanceOf(AppError);

    try {
      await ownership.assertContract(customerA.id, contractB.id);
      throw new Error("deveria ter lancado AppError");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(404);
      expect((error as AppError).code).toBe("RESOURCE_NOT_FOUND");
    }
  });

  it("BLOQUEIA o cliente B tentando acessar o contrato do cliente A (caminho inverso)", async () => {
    const { store, customerB, contractA } = buildTwoCustomersStore();
    const ownership = new OwnershipService(store);

    await expect(ownership.assertContract(customerB.id, contractA.id)).rejects.toBeInstanceOf(AppError);
  });

  it("listContracts nunca mistura contratos entre clientes diferentes no MESMO Map compartilhado", () => {
    const { store, customerA, customerB, contractA, contractB } = buildTwoCustomersStore();

    const contractsOfA = store.listContracts(customerA.id);
    const contractsOfB = store.listContracts(customerB.id);

    expect(contractsOfA).toEqual([contractA]);
    expect(contractsOfB).toEqual([contractB]);
    expect(contractsOfA.some((contract) => contract.id === contractB.id)).toBe(false);
    expect(contractsOfB.some((contract) => contract.id === contractA.id)).toBe(false);
  });

  it("um contractId inexistente nunca e confundido com um contrato de outro cliente", async () => {
    const { store, customerA } = buildTwoCustomersStore();
    const ownership = new OwnershipService(store);

    await expect(ownership.assertContract(customerA.id, "contrato-que-nao-existe")).rejects.toBeInstanceOf(AppError);
  });

  it("reverifica no SGP e repovoa o contrato quando o cache local esta vazio apos restart", async () => {
    const store = new InMemoryStore();
    const cpf = "12345678909";
    const customer = store.upsertCustomer({
      id: `customer_sgp_${sha256(cpf).slice(0, 16)}`,
      name: "Cliente Cache Frio",
      cpf,
      phone: "11999990000"
    });
    const sgpClient = {
      consultCustomerByContract: vi.fn().mockResolvedValue([
        {
          id_contrato: "5989",
          cpfCnpj: cpf,
          endereco_logradouro: "Rua Cache",
          endereco_numero: "10",
          endereco_cidade: "Franco da Rocha",
          endereco_uf: "SP",
          plano: "800 Mega",
          status: "Ativo"
        }
      ])
    };
    const ownership = new OwnershipService(store, sgpClient as never);

    const contract = await ownership.assertContract(customer.id, "5989");

    expect(contract).toMatchObject({
      id: "5989",
      customerId: customer.id,
      city: "Franco da Rocha",
      state: "SP",
      planName: "800 Mega",
      status: "ACTIVE"
    });
    expect(store.getContract("5989")).toEqual(contract);
  });

  it("registra SECURITY_CONTRACT_OWNERSHIP_MISMATCH no log quando bloqueia, nunca em caso de sucesso", async () => {
    const { store, customerA, customerB, contractA, contractB } = buildTwoCustomersStore();
    const ownership = new OwnershipService(store);
    const log = { warn: vi.fn() };

    await expect(
      ownership.assertContract(customerA.id, contractB.id, { log, cpfHash: "hash-a", endpoint: "/v1/contracts/:id/billing" })
    ).rejects.toBeInstanceOf(AppError);

    expect(log.warn).toHaveBeenCalledTimes(1);
    const details = log.warn.mock.calls[0]![0] as Record<string, unknown>;
    expect(details.securityEvent).toBe("SECURITY_CONTRACT_OWNERSHIP_MISMATCH");
    expect(details.authenticatedCustomerId).toBe(customerA.id);
    expect(details.authenticatedCpfHash).toBe("hash-a");
    expect(details.requestedContractId).toBe(contractB.id);
    expect(details.resolvedContractCustomerId).toBe(customerB.id);
    expect(details.endpoint).toBe("/v1/contracts/:id/billing");
    // Nunca o cpf em texto puro -- so o hash.
    expect(JSON.stringify(details)).not.toContain("39581323830");

    log.warn.mockClear();
    await ownership.assertContract(customerA.id, contractA.id, { log, cpfHash: "hash-a", endpoint: "/v1/contracts/:id/billing" });
    expect(log.warn).not.toHaveBeenCalled();
  });
});
