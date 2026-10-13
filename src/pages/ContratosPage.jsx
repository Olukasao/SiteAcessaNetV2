import { useEffect, useRef } from "react";
import { Download, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { company, contracts, whatsappLink } from "../data/site";
import { useReveal } from "../hooks/useReveal";
import "../sections/sections.css";
import "./contratos.css";

export default function ContratosPage() {
  const ref = useRef(null);
  useReveal(ref);
  useEffect(() => {
    document.title = "Contratos e Termos | AcessaNet";
  }, []);

  return (
    <>
      <section className="page-hero" aria-labelledby="ct-title">
        <div className="container">
          <span className="eyebrow">Transparência</span>
          <h1 id="ct-title">Contratos e Termos</h1>
          <p>Consulte nossos documentos oficiais, registrados em cartório, com as condições da prestação dos serviços.</p>
        </div>
      </section>

      <section ref={ref} className="section ct" aria-label="Documentos">
        <div className="container">
          <ul className="ct-grid">
            {contracts.map((c) => (
              <li key={c.id} className="ct-card" data-reveal>
                <div className="ct-top">
                  <span className="ct-ico" aria-hidden="true"><FileText size={22} /></span>
                  <span className="ct-code">{c.code}</span>
                </div>
                <h2 className="ct-title">{c.title}</h2>
                <p className="ct-party">{c.party}</p>
                <p className="ct-aud">{c.audience}</p>
                <p className="ct-reg"><ShieldCheck size={15} aria-hidden="true" /> {c.registry}</p>
                <div className="ct-actions">
                  <a className="btn btn--primary btn--sm" href={c.href} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden="true" /> Abrir PDF
                  </a>
                  <a className="btn btn--ghost btn--sm" href={c.href} download>
                    <Download size={16} aria-hidden="true" /> Baixar
                  </a>
                </div>
                <p className="ct-meta">PDF · {c.pages} páginas · {c.size}</p>
              </li>
            ))}
          </ul>

          <div className="ct-help" data-reveal>
            <div>
              <h2>Ficou com alguma dúvida sobre o seu contrato?</h2>
              <p>Nossa equipe tira suas dúvidas sobre as condições dos serviços.</p>
            </div>
            <div className="ct-help-actions">
              <a className="btn btn--primary" href={whatsappLink("Olá! Tenho uma dúvida sobre o meu contrato.")} target="_blank" rel="noreferrer">
                <FaWhatsapp aria-hidden="true" /> Falar no WhatsApp
              </a>
              <a className="btn btn--ghost" href={company.phoneHref}>{company.phone}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
