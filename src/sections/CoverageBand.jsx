import { useRef } from "react";
import CoverageForm from "../components/CoverageForm";
import { useUI } from "../context/UIContext";
import { useReveal } from "../hooks/useReveal";
import "./sections.css";

export default function CoverageBand() {
  const ref = useRef(null);
  const { openPlan } = useUI();
  useReveal(ref);
  return (
    <section ref={ref} id="cobertura" className="section section--dark cov" aria-labelledby="cov-title">
      <div className="cov-rings" aria-hidden="true">
        <span /><span /><span />
      </div>
      <div className="container cov-inner">
        <div className="section-head section-head--center" data-reveal>
          <span className="eyebrow">Cobertura</span>
          <h2 id="cov-title">A AcessaNet já chega aí?</h2>
          <p>Digite seu CEP. Em segundos você descobre se atendemos a sua cidade.</p>
        </div>
        <div className="cov-form" data-reveal>
          <CoverageForm variant="dark" onCovered={() => {}} />
          <p className="cov-cta">
            Já sabe o plano?{" "}
            <button type="button" onClick={() => openPlan("800")}>Ver o mais contratado</button>
          </p>
        </div>
      </div>
    </section>
  );
}
