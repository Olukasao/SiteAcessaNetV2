import { HeartPulse } from "lucide-react";
import { Link } from "react-router-dom";
import "./temSaudeCard.css";

export default function TemSaudeCard() {
  return (
    <Link
      to="/planos"
      className="temsaude-card"
      aria-label="Ver planos com TemSaúde"
    >
      <span className="temsaude-card-icon" aria-hidden="true">
        <HeartPulse size="60%" strokeWidth={2.2} />
      </span>

      <span className="temsaude-card-brand">
        <strong>
          Tem<span className="temsaude-card-accent">Saúde</span>
        </strong>
        <small>Telemedicina</small>
      </span>

      <span className="temsaude-card-divider" aria-hidden="true" />

      <span className="temsaude-card-info">
        <span>Benefício disponível</span>
        <span>em planos selecionados</span>
      </span>
    </Link>
  );
}
