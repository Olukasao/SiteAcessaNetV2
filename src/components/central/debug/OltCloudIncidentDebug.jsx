import { useState } from "react";
import { getApiBaseUrl } from "../../../services/clienteApi";

/**
 * Componente de TESTE MANUAL da integracao OLT Cloud -- nao e importado por
 * nenhuma rota/pagina de producao. Para usar: montar temporariamente em uma
 * pagina (ex.: dentro de ClienteArea) e apontar para o backend com
 * OLTCLOUD_DEBUG_ENABLED=true.
 *
 * So mostra o texto aprovado (item 13 do pedido) -- nunca "nossa equipe ja
 * esta trabalhando", ate existir confirmacao real de atendimento interno.
 */
export default function OltCloudIncidentDebug() {
  const [contractId, setContractId] = useState("");
  const [debugToken, setDebugToken] = useState("");
  const [state, setState] = useState({ status: "idle" });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!contractId.trim()) return;

    setState({ status: "loading" });

    try {
      const headers = {};
      if (debugToken.trim()) {
        headers["x-debug-token"] = debugToken.trim();
      }

      const response = await fetch(
        `${getApiBaseUrl()}/api/debug/oltcloud/client-status/${encodeURIComponent(contractId.trim())}`,
        { headers }
      );
      const payload = await response.json();

      if (!response.ok) {
        setState({ status: "error", message: payload?.error?.message || `Erro HTTP ${response.status}` });
        return;
      }

      setState({ status: "done", result: payload });
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  }

  return (
    <div style={{ maxWidth: 480, padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>OLT Cloud -- teste de status de incidente</h2>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
        Ferramenta de teste manual. Nao usar em producao com clientes reais.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={contractId}
          onChange={(event) => setContractId(event.target.value)}
          placeholder="Numero do contrato"
          style={{ flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6 }}
        />
        <input
          value={debugToken}
          onChange={(event) => setDebugToken(event.target.value)}
          placeholder="x-debug-token (opcional)"
          style={{ flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={state.status === "loading"}
          style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "#0f6cbd", color: "#fff" }}
        >
          Consultar
        </button>
      </form>

      {state.status === "loading" ? <p>Consultando...</p> : null}
      {state.status === "error" ? <p style={{ color: "#b42318" }}>Erro: {state.message}</p> : null}
      {state.status === "done" ? <IncidentResult result={state.result} /> : null}
    </div>
  );
}

function IncidentResult({ result }) {
  if (!result.success) {
    return <p style={{ color: "#64748b" }}>Sem informacao no momento (integracao indisponivel).</p>;
  }

  if (!result.affected) {
    return <p style={{ color: "#0a7d3f" }}>Nenhuma instabilidade coletiva identificada para este contrato.</p>;
  }

  const { incident } = result;

  return (
    <div>
      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fdba74",
          borderRadius: 8,
          padding: 14,
          marginBottom: 12
        }}
      >
        <strong>Identificamos uma possivel instabilidade que pode estar afetando sua conexao.</strong>
      </div>

      <details style={{ fontSize: 13, color: "#334155" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Detalhes tecnicos (modo debug)</summary>
        <ul style={{ marginTop: 8, lineHeight: 1.7 }}>
          <li>Tipo: {incident.type}</li>
          <li>OLT: {incident.olt || "-"}</li>
          <li>PON: {incident.pon || "-"}</li>
          <li>CTO: {incident.cto || "-"}</li>
          <li>Clientes/ONUs afetados: {incident.affectedDevices ?? "-"}</li>
          <li>Inicio: {incident.startedAt || "-"}</li>
        </ul>
      </details>
    </div>
  );
}
