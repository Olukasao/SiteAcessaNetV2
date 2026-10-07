import { Component } from "react";

const CHUNK_RELOAD_FLAG_KEY = "acessanet.chunkReloadAttempted";

/**
 * Falha de import dinamico (React.lazy) tem uma destas assinaturas
 * dependendo do navegador/motivo (arquivo sumiu depois de um deploy, rede
 * caiu no meio do download, etc.). Só nesse caso vale a pena recarregar a
 * página sozinho -- qualquer outro erro de render não se resolve com reload.
 */
function isChunkLoadError(error) {
  const message = String(error?.message || error || "");
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Unexpected token '<'/i.test(message) ||
    /Expected a JavaScript module/i.test(message)
  );
}

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Diagnóstico pra investigar reports de "site travou" -- nunca registra
 * senha/token/CPF/dados financeiros, só a PRESENÇA deles (hasAccessToken,
 * não o valor). "API reachable" é assíncrono (não bloqueia o catch) e sai
 * numa segunda linha de log quando resolver.
 */
function logDiagnostics(error) {
  try {
    const diagnostics = {
      appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown",
      url: window.location.href,
      timestamp: new Date().toISOString(),
      online: navigator.onLine,
      hasAccessToken: Boolean(window.localStorage.getItem("acessanet.customer.accessToken")),
      hasServiceWorker: "serviceWorker" in navigator,
      erro: String(error?.message || error || ""),
    };
    console.error("[Diagnostics]", diagnostics);

    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => console.error("[Diagnostics] cacheStorageKeys:", keys))
        .catch(() => undefined);
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => console.error("[Diagnostics] serviceWorkerRegistrations:", regs.length))
        .catch(() => undefined);
    }
    fetch("/api/health", { cache: "no-store" })
      .then((res) => console.error("[Diagnostics] apiReachable:", res.ok, "httpStatus:", res.status))
      .catch((fetchError) => console.error("[Diagnostics] apiReachable: false", String(fetchError)));
  } catch {
    // Diagnóstico nunca pode virar um segundo erro -- é só log auxiliar.
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
    logDiagnostics(error);

    const storage = safeSessionStorage();
    if (isChunkLoadError(error) && storage && !storage.getItem(CHUNK_RELOAD_FLAG_KEY)) {
      // Um reload controlado (uma vez só por sessão de aba) resolve o caso
      // mais comum: o navegador tinha um index.html antigo em cache e pediu
      // um chunk que já não existe. A flag em sessionStorage evita loop --
      // se o reload não resolver, cai na tela de erro manual abaixo.
      storage.setItem(CHUNK_RELOAD_FLAG_KEY, "1");
      window.location.reload();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  handleReload = () => {
    safeSessionStorage()?.removeItem(CHUNK_RELOAD_FLAG_KEY);
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          textAlign: "center",
          background: "linear-gradient(180deg, #f7fbff 0%, #eef7fd 100%)",
          color: "#061b35"
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 18 }}>
            {this.props.message || "Não foi possível carregar esta área da Central."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid rgba(6, 27, 53, 0.16)",
                background: "#ffffff",
                color: "#061b35",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #0095f6, #19b8ff)",
                color: "#ffffff",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
