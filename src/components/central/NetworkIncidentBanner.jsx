import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";
import { getNetworkStatus } from "../../services/clienteApi";
import "./networkIncidentBanner.css";

/**
 * Card de instabilidade regional (GET /api/central/network-status).
 * Nao decidido pelo frontend -- o backend so devolve affected=true quando o
 * RegionalIncidentService ja confirmou o incidente (nunca por suspeita/
 * baixa confianca, ver server/src/services/networkIncidentDetection).
 *
 * AINDA NAO MONTADO em nenhuma pagina de producao (ver relatorio) -- pra
 * usar, importar e renderizar dentro da home da Central
 * (ex.: pages/ClienteArea.jsx), passando o contractId selecionado.
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
