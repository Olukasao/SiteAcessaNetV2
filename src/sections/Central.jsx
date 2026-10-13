import { useRef } from "react";
import { ArrowUpRight, FileText, Gauge, Headphones, QrCode } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import apple from "../assets/apple.png";
import google from "../assets/google-play.webp";
import { appFeatures, company, whatsappLink } from "../data/site";
import { useReveal } from "../hooks/useReveal";
import "./sections.css";

const icons = [FileText, QrCode, Gauge, Headphones];

export default function Central() {
  const ref = useRef(null);
  useReveal(ref);
  return (
    <section ref={ref} id="atendimento" className="section central" aria-labelledby="central-title">
      <div className="container central-grid">
        <div className="central-card" data-reveal>
          <span className="eyebrow">Central do Assinante</span>
          <h2 id="central-title">Seu provedor na palma da mão.</h2>
          <p>Resolva tudo sem fila: faturas, pagamentos, suporte e controle da sua internet.</p>
          <ul className="central-feats">
            {appFeatures.map((f, i) => {
              const Icon = icons[i];
              return (
                <li key={f}><span aria-hidden="true"><Icon size={18} /></span>{f}</li>
              );
            })}
          </ul>
          <div className="central-ctas">
            <a className="btn btn--primary" href={company.centralUrl}>
              Acessar a Central <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <a className="store" href={company.apps.ios} target="_blank" rel="noreferrer" aria-label="Baixar na App Store">
              <img src={apple} alt="" loading="lazy" />
            </a>
            <a className="store" href={company.apps.android} target="_blank" rel="noreferrer" aria-label="Baixar no Google Play">
              <img src={google} alt="" loading="lazy" />
            </a>
          </div>
        </div>

        <div className="support" data-reveal>
          <h3>Atendimento de verdade, todos os dias.</h3>
          <a className="support-item" href={company.phoneHref}>
            <span className="support-k">Central 24h</span>
            <strong>{company.phone}</strong>
            <small>{company.supportHours}</small>
          </a>
          <a className="support-item support-item--whats" href={whatsappLink("Olá! Preciso de atendimento.")} target="_blank" rel="noreferrer">
            <span className="support-k"><FaWhatsapp aria-hidden="true" /> WhatsApp</span>
            <strong>Fale com a gente</strong>
            <small>Assistente virtual e equipe AcessaNet</small>
          </a>
        </div>
      </div>
    </section>
  );
}
