import { ArrowRight, Check, MapPin, ShieldCheck } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import Dialog from "./Dialog";
import { useUI } from "../context/UIContext";
import { company, plans, services } from "../data/site";
import { contractLink } from "../lib/contract";
import "./planModal.css";

export default function PlanModal() {
  const { planId, closePlan, coverage, openCoverage } = useUI();
  const plan = plans.find((p) => p.id === planId);

  return (
    <Dialog
      open={!!plan}
      onClose={closePlan}
      size="lg"
      title={plan ? `${plan.name}` : ""}
      description={plan?.tagline}
    >
      {plan && (
        <div className="pm">
          <div className="pm-top">
            <div className="pm-price">
              <span>R$</span>
              <strong>{plan.price.int}</strong>
              <span>,{plan.price.cents}</span>
              <small>/mês</small>
            </div>
            <p className="pm-note">
              <ShieldCheck size={16} aria-hidden="true" /> {plan.note} · Internet 100% fibra óptica
            </p>
          </div>

          <h3 className="pm-sub">Incluso no plano</h3>
          <ul className="pm-list">
            <li>
              <span className="pm-ico"><Check size={16} aria-hidden="true" /></span>
              <div>
                <strong>{plan.speed} {plan.unit}</strong>
                <small>Internet fibra óptica</small>
              </div>
            </li>
            {plan.includes.map((key) => {
              const s = services[key];
              return (
                <li key={key}>
                  <span className={`pm-ico ${s.logo ? "pm-ico--logo" : ""} ${s.dark ? "is-dark" : ""}`}>
                    {s.logo ? <img src={s.logo} alt="" /> : <Check size={16} aria-hidden="true" />}
                  </span>
                  <div>
                    <strong>{s.name}</strong>
                    <small>{s.detail}</small>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="pm-coverage">
            {coverage?.status === "ok" ? (
              <p className="pm-cov-ok">
                <MapPin size={16} aria-hidden="true" /> CEP {coverage.cep} · {coverage.city} — atendido
              </p>
            ) : (
              <button type="button" className="pm-cov-btn" onClick={() => { closePlan(); openCoverage(plan.id); }}>
                <MapPin size={16} aria-hidden="true" /> Consultar cobertura no meu CEP antes
              </button>
            )}
          </div>

          <div className="pm-actions">
            <a className="btn btn--primary btn--block" href={contractLink(plan, coverage)} target="_blank" rel="noreferrer">
              <FaWhatsapp aria-hidden="true" /> Contratar pelo WhatsApp <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="btn btn--ghost btn--block" href={company.phoneHref}>
              Ligar {company.phone}
            </a>
          </div>
          <p className="pm-legal">
            A contratação é concluída com nossa equipe comercial, que confirma a viabilidade técnica no seu endereço e as condições vigentes.
          </p>
        </div>
      )}
    </Dialog>
  );
}
