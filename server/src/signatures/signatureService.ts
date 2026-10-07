import { AppError } from "../errors.js";
import type { InMemoryStore } from "../repositories/inMemoryStore.js";
import { OwnershipService } from "../security/ownership.js";
import type { SignatureList, SignatureProvider } from "../integrations/sgp/providers.js";
import type { SgpUraClient } from "../integrations/sgp/sgpClient.js";

export type SignatureEvent = "sign_redirect" | "document_view";

/**
 * Modulo isolado de faturas/chamados/avisos, conforme pedido. Nunca
 * persiste nada sobre assinaturas -- a fonte da verdade e sempre a resposta
 * mais recente do provider (SGP real, mock de dev, ou "unavailable").
 */
export class SignatureService {
  private readonly ownership: OwnershipService;

  constructor(
    private readonly store: InMemoryStore,
    private readonly provider: SignatureProvider,
    sgpClient?: SgpUraClient
  ) {
    this.ownership = new OwnershipService(store, sgpClient);
  }

  async listSignatures(customerId: string, contractId: string): Promise<SignatureList> {
    const contract = await this.ownership.assertContract(customerId, contractId);
    const result = await this.provider.listSignatures(contract);

    if (result.source === "unavailable") {
      console.log(`[signatures] SGP_SIGNATURE_API_ERROR contractId=${contractId}`);
    } else {
      console.log(
        `[signatures] SIGNATURE_LIST_REQUEST contractId=${contractId} source=${result.source} count=${result.signatures.length}`
      );
    }

    return result;
  }

  /**
   * "signatureId" nunca e confiado so porque veio na URL: so loga o evento
   * depois de confirmar que ele pertence a lista mais recente do contrato
   * do cliente autenticado (mitigacao de IDOR). O SGP nao expoe "buscar
   * assinatura por id" -- por isso esta revalidacao sempre rebusca a lista
   * completa, nunca um lookup direto por id.
   */
  async recordEvent(customerId: string, contractId: string, signatureId: string, event: SignatureEvent): Promise<void> {
    const contract = await this.ownership.assertContract(customerId, contractId);
    const result = await this.provider.listSignatures(contract);
    const signature = result.signatures.find((item) => item.id === signatureId);

    if (!signature) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso nao encontrado.");
    }

    const label = event === "sign_redirect" ? "SIGNATURE_SIGN_REDIRECT" : "SIGNATURE_DOCUMENT_VIEW";
    console.log(`[signatures] ${label} contractId=${contractId} signatureId=${signatureId}`);
  }
}
