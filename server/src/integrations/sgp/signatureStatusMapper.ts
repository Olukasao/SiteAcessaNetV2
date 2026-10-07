export type SignatureStatus = "pending" | "awaiting_validation" | "signed" | "finished" | "canceled" | "expired" | "unknown";

/**
 * "signed" ("Assinado") e "finished" ("Finalizado") sao estados DIFERENTES e
 * sequenciais no fluxo oficial do SGP (confirmado em
 * wiki.sgp.net.br/wiki.php?id=relatorios_assinatura_eletronica, 2026-10-02):
 * assinatura completa (signed) ainda passa por validacao antes do documento
 * ficar disponivel para impressao (finished). Para o cliente final, porem,
 * os dois tratam igual na UI (ver AssinaturasPage/SignatureCard em
 * ClienteArea.jsx -- "Documento assinado com sucesso.", mesmas acoes de
 * visualizar/baixar quando documentUrl existir).
 *
 * Os 5 textos abaixo ("em_processamento", "assinado_aguardando_validacao",
 * "assinado", "finalizado", "cancelado") sao os unicos CONFIRMADOS contra a
 * documentacao oficial do SGP -- mas como TEXTO DE UI do relatorio
 * "Assinatura Eletronica", nao como string crua de um campo de API REST
 * (essa API nunca foi encontrada/documentada publicamente). As variantes
 * extras do mapa (pendente, aguardando_assinatura, concluido, etc.) sao
 * chute de tolerancia, mantidas do pedido original. "expirado"/"expirada"
 * nao aparecem na lista oficial de 5 -- mantido so para o caso ("Expirado,
 * caso exista na API") pedido originalmente; nunca deve disparar sozinho
 * enquanto nao for visto na pratica.
 * Reavaliar esta tabela inteira no dia em que a resposta real da API for
 * capturada via DevTools. Mapeamento e sempre 1:1 por string de status --
 * nunca inferido a partir de data, TAG ou texto livre.
 */
const statusMap: Record<string, SignatureStatus> = {
  em_processamento: "pending",
  pendente: "pending",
  pendente_assinatura: "pending",
  aguardando_assinatura: "pending",
  aguardando_validacao: "awaiting_validation",
  assinado_aguardando_validacao: "awaiting_validation",
  assinado: "signed",
  finalizado: "finished",
  concluido: "finished",
  cancelado: "canceled",
  cancelada: "canceled",
  expirado: "expired",
  expirada: "expired"
};

const statusLabels: Record<SignatureStatus, string> = {
  pending: "Assinatura pendente",
  awaiting_validation: "Aguardando validação",
  signed: "Assinado",
  finished: "Finalizado",
  canceled: "Cancelado",
  expired: "Expirado",
  unknown: "Status indisponível"
};

function normalizeStatusText(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function mapSgpSignatureStatus(rawStatus: string): SignatureStatus {
  const normalized = normalizeStatusText(rawStatus);
  return statusMap[normalized] ?? "unknown";
}

export function getSignatureStatusLabel(status: SignatureStatus): string {
  return statusLabels[status];
}
