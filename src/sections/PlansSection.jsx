import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, HeartPulse, PhoneCall } from "lucide-react";
import PlanCard from "../components/PlanCard";
import { fixedLine, plans, temSaudePlans, whatsappLink } from "../data/site";
import { useReveal } from "../hooks/useReveal";
import "./plans.css";

export default function PlansSection({ showCompareLink = true, title = "Escolha a velocidade da sua casa" }) {
  const ref = useRef(null);
  useReveal(ref);

  return (
    <section ref={ref} id="planos" className="section section--dark plans" aria-labelledby="plans-title">
      <div className="plans-glow" aria-hidden="true" />
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">Planos residenciais</span>
          <h2 id="plans-title">{title}</h2>
          <p>Fibra óptica de ponta a ponta, com entretenimento e serviços digitais inclusos.</p>
        </div>

        <div className="plans-grid">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}

          <aside className="plans-addons" aria-label="Adicionais" data-reveal>
            <h3>Turbine seu plano</h3>
            <a className="addon" href={whatsappLink(`Olá! Quero saber mais sobre a ${fixedLine.name} por ${fixedLine.priceText}/mês.`)} target="_blank" rel="noreferrer">
              <span className="addon-ico" aria-hidden="true"><PhoneCall size={20} /></span>
              <span className="addon-body">
                <strong>{fixedLine.name}</strong>
                <small>Áudio claro e portabilidade do número</small>
              </span>
              <span className="addon-price">{fixedLine.priceText}<small>/mês</small></span>
            </a>
            <a className="addon" href={whatsappLink("Olá! Quero adicionar a telemedicina TemSaúde ao meu plano.")} target="_blank" rel="noreferrer">
              <span className="addon-ico" aria-hidden="true"><HeartPulse size={20} /></span>
              <span className="addon-body">
                <strong>TemSaúde</strong>
                <small>Telemedicina individual ou familiar</small>
              </span>
              <span className="addon-price">
                <small>a partir de</small>
                {temSaudePlans[0].priceText}
              </span>
            </a>
            {showCompareLink && (
              <Link to="/planos#comparar" className="plans-compare">
                Comparar benefícios <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
