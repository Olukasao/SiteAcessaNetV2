/**
 * Eventos da vitrine de upgrade de plano (Central do Assinante > Meu plano).
 * Apenas estrutura os eventos em `window.dataLayer` para integração futura
 * (GTM/GA4 ou outro) — nenhuma ferramenta de analytics é instalada aqui.
 */

export const PLAN_UPGRADE_EVENTS = {
  VIEW: "plan_upgrade_view",
  DETAILS_CLICK: "plan_upgrade_details_click",
  MODAL_OPEN: "plan_upgrade_modal_open",
  START: "plan_upgrade_start",
  CANCEL: "plan_upgrade_cancel",
  SUCCESS: "plan_upgrade_success"
};

export function trackPlanUpgradeEvent(eventName, payload = {}) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...payload });
}
