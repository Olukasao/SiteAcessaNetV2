/**
 * Porta para encaminhar uma Solicitacao de Contratacao a um sistema externo
 * (ex.: SGP -- pre-cadastro/ordem de servico) no FUTURO.
 *
 * Hoje e INERTE de proposito: nao existe endpoint de pre-cadastro do SGP
 * documentado/validado para este fluxo, e nenhum endpoint deve ser inventado.
 * O container injeta `NoopContractRequestForwarder` e nenhuma rota o chama.
 *
 * Quando houver uma integracao real:
 *  1. implementar esta interface em integrations/<sistema>/ (sem logar dados pessoais);
 *  2. chamar `forward` FORA da requisicao publica (fila/job ou acao explicita no admin),
 *     para que falha externa nunca derrube o recebimento do pedido;
 *  3. registrar o resultado como evento em contract_request_events.
 */
export interface ContractRequestForwardPayload {
  requestId: number;
  protocol: string;
  planId: string;
}

export type ContractRequestForwardResult =
  | { status: "not_configured" }
  | { status: "forwarded"; externalId: string }
  | { status: "failed"; reason: string };

export interface ContractRequestForwarder {
  readonly enabled: boolean;
  forward(payload: ContractRequestForwardPayload): Promise<ContractRequestForwardResult>;
}

export class NoopContractRequestForwarder implements ContractRequestForwarder {
  readonly enabled = false;

  async forward(_payload: ContractRequestForwardPayload): Promise<ContractRequestForwardResult> {
    return { status: "not_configured" };
  }
}
