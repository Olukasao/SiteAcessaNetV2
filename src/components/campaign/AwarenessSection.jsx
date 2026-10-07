import "./awarenessSection.css";
import { HeartHandshake, ScanLine, Stethoscope, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import PinkRibbonBadge from "./PinkRibbonBadge";

const awarenessCards = [
  {
    icon: HeartHandshake,
    title: "Autoexame / Autoconhecimento",
    text: "Conheça seu corpo e fique atenta a mudanças.",
  },
  {
    icon: ScanLine,
    title: "Mamografia",
    text: "A detecção precoce aumenta as chances de tratamento.",
  },
  {
    icon: Stethoscope,
    title: "Consulta preventiva",
    text: "Converse com um profissional de saúde e tire suas dúvidas.",
  },
];

export default function AwarenessSection() {
  return (
    <section className="campaign-awareness" aria-labelledby="campaign-awareness-title">
      <div className="campaign-awareness-wrap">
        <div className="campaign-awareness-header">
          <PinkRibbonBadge label="Outubro Rosa 2026" />
          <h2 id="campaign-awareness-title">Conexão com o cuidado</h2>
          <p>
            Neste mês de conscientização, reforçamos a importância da
            prevenção e do autocuidado.
          </p>
        </div>

        <div className="campaign-awareness-cards">
          {awarenessCards.map((card) => {
            const Icon = card.icon;

            return (
              <div className="campaign-awareness-card" key={card.title}>
                <span className="campaign-awareness-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            );
          })}
        </div>

        <div className="campaign-temsaude-highlight">
          <span className="campaign-temsaude-icon" aria-hidden="true">
            <Smartphone size={26} />
          </span>

          <div className="campaign-temsaude-copy">
            <h3>Telemedicina TemSaúde</h3>
            <p>
              Aproveite nossos planos com acesso ao aplicativo de
              telemedicina TemSaúde. Mais cuidado, praticidade e bem-estar
              para você e sua família.
            </p>
          </div>

          <Link to="/planos" className="campaign-temsaude-cta">
            Conheça nossos planos
          </Link>
        </div>
      </div>
    </section>
  );
}
