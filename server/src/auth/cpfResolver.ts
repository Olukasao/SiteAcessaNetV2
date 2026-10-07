import type { ContractSummary } from "../types.js";
import type { SgpUraClient } from "../integrations/sgp/sgpClient.js";
import type { CustomerRecord, InMemoryStore } from "../repositories/inMemoryStore.js";
import { normalizeCpf } from "./cpf.js";
import { mapSgpCustomer } from "../integrations/sgp/sgpMapper.js";

export interface CpfResolverResult {
  customer: CustomerRecord;
  contracts: ContractSummary[];
}

/** Resolve CPF -> cliente/contratos consultando o SGP, cacheando o resultado no InMemoryStore (customers/contracts). */
export class CpfResolver {
  constructor(
    private readonly store: InMemoryStore,
    private readonly client: SgpUraClient
  ) {}

  async resolve(cpf: string): Promise<CpfResolverResult | null> {
    const digits = normalizeCpf(cpf);
    if (digits.length !== 11) {
      return null;
    }

    const contracts = await this.client.consultCustomerByCpf(digits);
    if (contracts.length === 0) {
      return null;
    }

    const mapped = mapSgpCustomer(digits, contracts);
    if (!mapped) {
      return null;
    }

    const customer = this.store.upsertCustomer(mapped.customer);
    for (const contract of mapped.contracts) {
      this.store.upsertContract(contract);
    }

    return { customer, contracts: mapped.contracts };
  }
}
