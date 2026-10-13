import { useRef } from "react";
import { ArrowRight, Check, Info } from "lucide-react";
import { services } from "../data/site";
import { useUI } from "../context/UIContext";
import "./planCard.css";

// Card premium com "tilt" 3D sutil e luz que segue o cursor. O efeito é só
// CSS custom properties atualizadas no pointermove -- sem re-render React.
export default function PlanCard({ plan }) {
  const ref = useRef(null);
  const { openPlan } = useUI();

  const onMove = (e) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 5}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 6}deg`);
  };
  const onLeave = () => {
    const el = ref.current;
    el?.style.setProperty("--rx", "0deg");
    el?.style.setProperty("--ry", "0deg");
  };

  const visibleIncludes = plan.includes.slice(0, 4);
  const more = plan.includes.length - visibleIncludes.length;

  return (
    <article
      ref={ref}
      className={`plan-card ${plan.featured ? "plan-card--featured" : ""}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-labelledby={`plan-${plan.id}-title`}
      data-reveal
    >
      <div className="plan-card-light" aria-hidden="true" />
      {plan.badge && <span className="plan-badge">{plan.badge}</span>}

      <header className="plan-card-head">
        <span className="plan-kicker">Internet fibra óptica{plan.variant ? ` ${plan.variant}` : ""}</span>
        <h3 id={`plan-${plan.id}-title`} className="plan-speed">
          {plan.speed}
          <span>{plan.unit}</span>
          {plan.variant && <span className="sr-only"> {plan.variant}</span>}
        </h3>
        <p className="plan-tagline">{plan.tagline}</p>
      </header>

      <ul className="plan-includes" aria-label="Incluso no plano">
        {visibleIncludes.map((key) => {
          const s = services[key];
          return (
            <li key={key}>
              <span className={`plan-include-icon ${s.logo && s.dark ? "is-dark" : ""}`} aria-hidden="true">
                {s.logo ? <img src={s.logo} alt="" loading="lazy" /> : <Check size={16} />}
              </span>
              <span>{s.name}</span>
            </li>
          );
        })}
        {more > 0 && <li className="plan-more">+ {more} benefício{more > 1 ? "s" : ""}</li>}
      </ul>

      <div className="plan-price" aria-label={`${plan.priceText} por mês`}>
        <span className="plan-price-cur">R$</span>
        <span className="plan-price-int">{plan.price.int}</span>
        <span className="plan-price-rest">
          <span>,{plan.price.cents}</span>
          <small>/mês</small>
        </span>
      </div>
      <p className="plan-note">{plan.note}</p>

      <div className="plan-actions">
        <button type="button" className="btn btn--primary btn--block" onClick={() => openPlan(plan.id)}>
          Quero este plano <ArrowRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="plan-details" onClick={() => openPlan(plan.id)}>
          <Info size={16} aria-hidden="true" /> Ver detalhes
        </button>
      </div>
    </article>
  );
}
