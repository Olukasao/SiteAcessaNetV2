import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const MIN_GAP_BETWEEN_CHECKS_MS = 5 * 60 * 1000;

async function fetchServerVersion() {
  try {
    const response = await fetch("/api/frontend-version", { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * Detecta quando o backend/CDN já serviu uma build mais nova do que a que
 * esta aba carregou, ANTES de um import dinâmico falhar (ver ErrorBoundary,
 * que trata esse caso quando já aconteceu). Checa /version.json periodicamente
 * e quando a aba volta a ficar visível -- nunca recarrega sozinho na hora:
 * só avisa (banner com botão) e aplica de verdade na próxima troca de rota,
 * que é o ponto menos disruptivo pra interromper quem está usando o site.
 */
export default function VersionWatcher() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const lastCheckRef = useRef(0);
  const pendingRef = useRef(false);
  const isFirstRouteChange = useRef(true);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      lastCheckRef.current = Date.now();
      const serverVersion = await fetchServerVersion();
      if (cancelled || !serverVersion) return;
      if (serverVersion !== __APP_VERSION__) {
        pendingRef.current = true;
        setUpdateAvailable(true);
      }
    }

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheckRef.current < MIN_GAP_BETWEEN_CHECKS_MS) return;
      check();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (isFirstRouteChange.current) {
      isFirstRouteChange.current = false;
      return;
    }
    if (pendingRef.current) {
      window.location.reload();
    }
  }, [location.pathname]);

  if (!updateAvailable) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 14,
        background: "#061b35",
        color: "#ffffff",
        boxShadow: "0 12px 32px rgba(6, 27, 53, 0.32)",
        fontSize: "0.9rem",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span>Uma nova versão da AcessaNet está disponível.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: "none",
          background: "linear-gradient(135deg, #0095f6, #19b8ff)",
          color: "#ffffff",
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Atualizar agora
      </button>
    </div>
  );
}
