import type { SgpContractRaw, SgpUraClient } from "../../integrations/sgp/sgpClient.js";

export interface ClientRegion {
  city?: string;
  neighborhood?: string;
}

/**
 * Extrai bairro/cidade do cadastro do SGP pra um contrato JA CONHECIDO --
 * nunca usado pra varrer clientes em massa (o backend nao tem um roster de
 * "todos os contratos por bairro", so consulta pontual). Mesma fonte que
 * SgpBackedContractProvider.enrichContract ja usa (endereco_bairro/bairro),
 * so exposta como campo proprio em vez de string unica.
 */
export class ClientRegionResolver {
  constructor(private readonly sgpClient: SgpUraClient) {}

  async resolve(contractId: string): Promise<ClientRegion> {
    try {
      const contracts = await this.sgpClient.consultCustomerByContract(contractId);
      const raw = findContract(contracts, contractId);
      if (!raw) {
        return {};
      }

      const city = pickString(raw, ["endereco_cidade", "enderecoCidade", "cidade"]);
      const neighborhood = pickString(raw, ["endereco_bairro", "enderecoBairro", "bairro"]);

      return {
        ...(city ? { city } : {}),
        ...(neighborhood ? { neighborhood } : {})
      };
    } catch {
      return {};
    }
  }
}

function findContract(contracts: SgpContractRaw[], contractId: string) {
  return (
    contracts.find(
      (item) => String(pickString(item, ["id_contrato", "contratoId", "idContrato", "contrato_id"])) === contractId
    ) ?? contracts[0]
  );
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
