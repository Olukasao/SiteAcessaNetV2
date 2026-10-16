import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";
import { getNetworkStatus } from "../clienteApi";
import "./networkIncidentBanner.css";

/**
 * Card de instabilidade regional (GET /api/central/network-status).
 * Nao decidido pelo frontend -- o backend so devolve affected=true quando o
 * RegionalIncidentService ja confirmou o incidente (nunca por suspeita/
 * baixa confianca, ver server/src/services/networkIncidentDetection).
 *
 * Montado em pages/ClienteArea.jsx (fora do switch de abas -- aparece em
 * qualquer pagina da Central, nao so "Internet"), recebendo o contractId
 * selecionado.
 */
export default function NetworkIncidentBanner({ contractId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getNetworkStatus(contractId)
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (!cancelled) setStatus({ affected: false, status: "unknown" });
      });

    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (!status?.affected) {
    return null;
  }

  return (
    <div className="network-incident-banner" role="status">
      <div className="network-incident-banner-icon">
        <Wifi size={22} aria-hidden="true" />
      </div>
      <div className="network-incident-banner-copy">
        <strong>Identificamos uma instabilidade na sua região</strong>
        <p>
          Detectamos uma possível indisponibilidade afetando clientes próximos. Nossa equipe já está acompanhando a
          situação.
        </p>
        <p className="network-incident-banner-note">Não é necessário abrir um novo chamado neste momento.</p>
        {status.startedAt ? (
          <span className="network-incident-banner-time">Instabilidade identificada às {formatTime(status.startedAt)}</span>
        ) : null}
      </div>
    </div>
  );
}

function formatTime(isoDate) {
  try {
    return new Date(isoDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
