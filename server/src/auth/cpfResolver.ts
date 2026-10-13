import type { ContractSummary } from "../types.js";
import type { SgpUraClient } from "../integrations/sgp/sgpClient.js";
import type { CustomerRecord, InMemoryStore } from "../repositories/inMemoryStore.js";
import { getDocumentType, normalizeDocument } from "./cpf.js";
import { mapSgpCustomer } from "../integrations/sgp/sgpMapper.js";

export interface CpfResolverResult {
  customer: CustomerRecord;
  contracts: ContractSummary[];
}

/** Resolve CPF/CNPJ -> cliente/contratos consultando o SGP, cacheando o resultado no InMemoryStore (customers/contracts). */
export class CpfResolver {
  constructor(
    private readonly store: InMemoryStore,
    private readonly client: SgpUraClient
  ) {}

  async resolve(documento: string): Promise<CpfResolverResult | null> {
    const digits = normalizeDocument(documento);
    if (!getDocumentType(digits)) {
      return null;
    }

    const contracts = await this.client.consultCustomerByDocument(digits);
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
