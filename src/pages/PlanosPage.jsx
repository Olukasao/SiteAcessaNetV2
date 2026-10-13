import { useEffect, useRef } from "react";
import { Check, HeartPulse, PhoneCall } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import PlansSection from "../sections/PlansSection";
import CompareSection from "../sections/CompareSection";
import CoverageBand from "../sections/CoverageBand";
import { fixedLine, temSaudePlans, whatsappLink } from "../data/site";
import { useReveal } from "../hooks/useReveal";
import "../sections/sections.css";

export default function PlanosPage() {
  const ref = useRef(null);
  useReveal(ref);
  useEffect(() => {
    document.title = "Planos de internet fibra | AcessaNet";
  }, []);

  return (
    <>
      <section className="page-hero" aria-labelledby="planos-title">
        <div className="container">
          <span className="eyebrow">Planos</span>
          <h1 id="planos-title">Internet fibra para cada ritmo da casa.</h1>
          <p>Compare velocidades e benefícios, consulte a cobertura do seu CEP e contrate direto com a nossa equipe.</p>
        </div>
      </section>

      <PlansSection showCompareLink={false} title="Planos residenciais" />
      <CompareSection />

      <section ref={ref} className="section" aria-labelledby="extras-title">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">Adicionais</span>
            <h2 id="extras-title">Complete sua assinatura</h2>
          </div>
          <div className="extras-grid">
            <article className="extra" data-reveal>
              <span className="biz-ico" aria-hidden="true"><PhoneCall size={20} /></span>
              <h3>{fixedLine.name}</h3>
              <p>{fixedLine.description}</p>
              <ul className="extra-list">
                {fixedLine.benefits.map((b) => (
                  <li key={b}><Check size={16} aria-hidden="true" /> {b}</li>
                ))}
              </ul>
              <div className="extra-price">
                <span>Por apenas</span>
                <strong>{fixedLine.priceText}<small style={{ fontSize: ".9rem" }}>/mês</small></strong>
              </div>
              <a className="btn btn--primary" href={whatsappLink(`Olá! Quero contratar a ${fixedLine.name} por ${fixedLine.priceText}/mês.`)} target="_blank" rel="noreferrer">
                <FaWhatsapp aria-hidden="true" /> Contratar linha fixa
              </a>
            </article>

            <article className="extra" data-reveal>
              <span className="biz-ico" aria-hidden="true"><HeartPulse size={20} /></span>
              <h3>TemSaúde</h3>
              <p>Consultas, exames e descontos em farmácias direto na sua internet. Já incluso no plano 800 Mega.</p>
              <div className="extra-prices">
                {temSaudePlans.map((p) => (
                  <div className="extra-price" key={p.name}>
                    <span>{p.name}</span>
                    <strong>{p.priceText}</strong>
                    <ul>
                      {p.items.map((i) => (
                        <li key={i}><Check size={14} aria-hidden="true" /> {i}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <a className="btn btn--ghost" href={whatsappLink("Olá! Quero contratar o TemSaúde.")} target="_blank" rel="noreferrer">
                <FaWhatsapp aria-hidden="true" /> Quero o TemSaúde
              </a>
            </article>
          </div>
        </div>
      </section>

      <CoverageBand />
    </>
  );
}
