import { AppError } from "../errors.js";
import type { InMemoryStore, TicketRecord } from "../repositories/inMemoryStore.js";
import type { ContractSummary } from "../types.js";
import type { SgpUraClient } from "../integrations/sgp/sgpClient.js";
import { mapSgpContract, pickString } from "../integrations/sgp/sgpMapper.js";
import { sha256 } from "./hash.js";

/** Logger minimo (nao importa tipos do Fastify aqui pra nao acoplar essa classe ao framework). */
interface OwnershipLogger {
  warn: (details: Record<string, unknown>, message?: string) => void;
}

interface OwnershipAuditContext {
  log?: OwnershipLogger;
  endpoint?: string;
  /** Hash do CPF, nunca o CPF em texto puro (ver security/hash.ts -- essa regra vale pra log tambem). */
  cpfHash?: string;
}

function isLikelySgpContractId(value: string) {
  return /^\d+$/.test(value);
}

export class OwnershipService {
  /**
   * sgpClient e opcional (testes/chamadores sem integracao SGP real
   * continuam funcionando, so sem o fallback abaixo) -- em producao
   * (container.ts) sempre vem preenchido.
   */
  constructor(
    private readonly store: InMemoryStore,
    private readonly sgpClient?: SgpUraClient
  ) {}

  /**
   * CAUSA RAIZ corrigida em 2026-10-05: InMemoryStore.contracts SO e
   * populado em CpfResolver.resolve() (login/checkAccess/setupPassword),
   * NUNCA em LocalPasswordAuthService.refresh() (so revalida o token contra
   * a sessao, persistida em MySQL/SQLite -- isso sim sobrevive a um
   * restart). Toda vez que o processo reinicia (deploy), o cache de
   * contrato fica vazio, mas a SESSAO do cliente (token) continua valida
   * por ate 30 dias. Resultado real observado em producao: cliente ja
   * logado antes de um deploy, cujo token sobrevive via refresh, ficava
   * bloqueado de ver o PROPRIO contrato (404 "RESOURCE_NOT_FOUND" em
   * connection/billing/tickets/invoices) ate fazer logout+login de novo --
   * nenhum erro visivel, so dado sumindo silenciosamente.
   *
   * Fix: numa cache miss, reverifica direto no SGP (consultCustomerByContract,
   * que so precisa do contractId, nunca do CPF em texto puro que nao
   * guardamos) antes de bloquear. So aceita o contrato se o cpfCnpj que o
   * PROPRIO SGP devolve pra esse contrato, hasheado do mesmo jeito que
   * CpfResolver/mapSgpCustomer fazem, bater com o customerId autenticado --
   * nunca confia em nenhum outro campo (nome, clienteId numerico etc.) que
   * um contrato manipulado pelo frontend poderia tentar explorar.
   */
  async assertContract(
    customerId: string,
    contractId: string,
    context?: OwnershipAuditContext
  ): Promise<ContractSummary> {
    const cached = this.store.getContract(contractId);
    if (cached && cached.customerId === customerId) {
      return cached;
    }

    if (!cached && this.sgpClient && isLikelySgpContractId(contractId)) {
      const reverified = await this.reverifyOwnership(customerId, contractId);
      if (reverified) {
        return reverified;
      }
    }

    context?.log?.warn(
      {
        securityEvent: "SECURITY_CONTRACT_OWNERSHIP_MISMATCH",
        authenticatedCustomerId: customerId,
        authenticatedCpfHash: context?.cpfHash,
        requestedContractId: contractId,
        resolvedContractCustomerId: cached?.customerId ?? null,
        endpoint: context?.endpoint
      },
      "Blocked cross-account contract access"
    );

    throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso nao encontrado.");
  }

  private async reverifyOwnership(customerId: string, contractId: string): Promise<ContractSummary | null> {
    try {
      const contracts = await this.sgpClient!.consultCustomerByContract(contractId);
      const raw =
        contracts.find(
          (item) =>
            String(
              pickString(item, ["id", "id_contrato", "contratoId", "contrato_id", "idContrato", "contrato"])
            ) === contractId
        ) ?? contracts[0];

      if (!raw) {
        return null;
      }

      const cpf = pickString(raw, ["cpfCnpj", "cpf_cnpj", "cpf"]).replace(/\D/g, "");
      if (cpf.length < 11) {
        return null;
      }

      const derivedCustomerId = `customer_sgp_${sha256(cpf).slice(0, 16)}`;
      if (derivedCustomerId !== customerId) {
        return null;
      }

      const contract = mapSgpContract(raw, customerId);
      if (!contract) {
        return null;
      }

      this.store.upsertContract(contract);
      return contract;
    } catch {
      return null;
    }
  }

  assertTicket(customerId: string, ticketId: string): TicketRecord {
    const ticket = this.store.tickets.get(ticketId);
    if (!ticket || ticket.customerId !== customerId) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso nao encontrado.");
    }
    return ticket;
  }

  assertDiagnosis(customerId: string, diagnosisId: string) {
    const diagnosis = this.store.diagnoses.get(diagnosisId);
    if (!diagnosis || diagnosis.customerId !== customerId) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso nao encontrado.");
    }
    return diagnosis;
  }
}
