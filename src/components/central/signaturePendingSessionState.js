const STORAGE_PREFIX = "acessanet.customer.signaturePendingModalShown.";

/**
 * Controla so se o MODAL ja apareceu nesta aba/sessao -- nunca se a
 * assinatura foi concluida (a fonte da verdade disso e sempre o SGP, nunca
 * o navegador). Chave por customerId+contractId: cada contrato pode ter
 * pendencia independente, entao trocar de contrato pode reabrir o modal
 * para um contrato ainda nao visto nesta sessao.
 */
function buildKey(customerId, contractId) {
  return `${STORAGE_PREFIX}${customerId || ""}.${contractId || ""}`;
}

export function hasShownSignatureModalThisSession(customerId, contractId) {
  try {
    return window.sessionStorage.getItem(buildKey(customerId, contractId)) === "true";
  } catch {
    return false;
  }
}

export function markSignatureModalShownThisSession(customerId, contractId) {
  try {
    window.sessionStorage.setItem(buildKey(customerId, contractId), "true");
  } catch {
    // sessionStorage indisponivel (modo privado etc.) -- degrada pra "mostra sempre", aceitavel.
  }
}

/** Chamar no logout: sem isso, login -> logout -> login na mesma aba nao reabriria o modal mesmo com pendencia real. */
export function clearSignatureModalSessionState() {
  try {
    const keysToRemove = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // sessionStorage indisponivel -- nada a limpar.
  }
}
