import type { Notice, NoticeAudienceContext } from "./types.js";

/**
 * Funcao pura: dado um aviso e o contexto do cliente (customerId + contrato
 * selecionado, se houver), decide se o aviso e para ele. Usada tanto em
 * GET /v1/notices/active (lista) quanto em POST /v1/notices/:id/view
 * (revalidacao no servidor antes de gravar visualizacao -- nunca confia
 * apenas em o cliente ter recebido o aviso antes).
 */
export function matchesAudience(notice: Notice, context: NoticeAudienceContext): boolean {
  const filter = notice.audienceFilter;

  if (!filter || filter.type === "all" || notice.audienceType === "all") {
    return true;
  }

  switch (filter.type) {
    case "contract":
      return Boolean(context.contract && filter.contractIds.includes(context.contract.id));
    case "customer":
      return filter.customerIds.includes(context.customerId);
    case "plan":
      return Boolean(context.contract && filter.planNames.includes(context.contract.planName));
    case "city":
      return Boolean(context.contract && filter.cities.includes(context.contract.city));
    case "state":
      return Boolean(context.contract && filter.states.includes(context.contract.state));
    case "contract_status":
      return Boolean(context.contract && filter.statuses.includes(context.contract.status));
    default:
      return false;
  }
}
