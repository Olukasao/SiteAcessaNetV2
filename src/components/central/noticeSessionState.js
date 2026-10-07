const STORAGE_PREFIX = "acessanet.customer.noticeSeen.";

/**
 * "once_per_session" e controlado no navegador (sessionStorage), nao no
 * servidor -- guarda a VERSAO vista, nao so um booleano, pra o aviso
 * reaparecer uma vez se o admin editar o conteudo depois que o cliente ja
 * tinha visto (mesma logica de central_notice_views.viewed_version no
 * backend, so que aqui e por sessao de navegador em vez de por cliente).
 */
export function hasSeenThisSession(noticeId, version) {
  try {
    return window.sessionStorage.getItem(`${STORAGE_PREFIX}${noticeId}`) === String(version);
  } catch {
    return false;
  }
}

export function markSeenThisSession(noticeId, version) {
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${noticeId}`, String(version));
  } catch {
    // sessionStorage indisponivel (modo privado etc.) -- degrada pra "mostra sempre", aceitavel.
  }
}
