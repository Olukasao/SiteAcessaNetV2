import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Check } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { businessPlans, whatsappLink } from "../data/site";
import { useReveal } from "../hooks/useReveal";
import "./sections.css";

export default function Empresas({ full = false }) {
  const ref = useRef(null);
  useReveal(ref);
  return (
    <section ref={ref} id="empresas" className="section section--tint biz" aria-labelledby="biz-title">
      <div className="container biz-grid">
        <div className="biz-copy" data-reveal>
          <span className="eyebrow">Internet empresarial</span>
          <h2 id="biz-title">Internet estável para quem não pode parar.</h2>
          <p>
            Escolha entre um plano comercial para o dia a dia ou um link dedicado com garantia total de banda e suporte prioritário.
          </p>
          <div className="biz-ctas">
            <a className="btn btn--primary" href={whatsappLink("Olá! Gostaria de um plano corporativo.")} target="_blank" rel="noreferrer">
              <FaWhatsapp aria-hidden="true" /> Falar com especialista
            </a>
            {!full && (
              <Link to="/empresas" className="btn btn--ghost">
                Ver soluções <ArrowRight size={18} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        <div className="biz-plans">
          {businessPlans.map((p) => (
            <article key={p.name} className={`biz-plan ${p.highlight ? "is-highlight" : ""}`} data-reveal>
              <header>
                <span className="biz-ico" aria-hidden="true"><Building2 size={20} /></span>
                <h3>{p.name}</h3>
                <span className="biz-badge">{p.badge}</span>
              </header>
              <p>{p.description}</p>
              <ul>
                {p.items.map((it) => (
                  <li key={it}><Check size={16} aria-hidden="true" /> {it}</li>
                ))}
              </ul>
              <footer>{p.footer}</footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
