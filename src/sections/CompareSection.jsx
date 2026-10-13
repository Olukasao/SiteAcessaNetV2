import { useRef } from "react";
import { Check, Minus } from "lucide-react";
import { comparisonRows, plans } from "../data/site";
import { useUI } from "../context/UIContext";
import { useReveal } from "../hooks/useReveal";

export default function CompareSection() {
  const ref = useRef(null);
  const { openPlan } = useUI();
  useReveal(ref);

  return (
    <section ref={ref} id="comparar" className="section section--tint" aria-labelledby="compare-title">
      <div className="container">
        <div className="section-head section-head--center" data-reveal>
          <span className="eyebrow">Comparar</span>
          <h2 id="compare-title">Lado a lado, sem surpresa</h2>
          <p>Tudo o que vem em cada plano, para você decidir com calma.</p>
        </div>

        <div className="compare-wrap" data-reveal>
          <table className="compare">
            <caption className="sr-only">Comparação de benefícios entre os planos residenciais</caption>
            <thead>
              <tr>
                <td />
                {plans.map((p) => (
                  <th key={p.id} scope="col" className={p.featured ? "is-featured" : ""}>
                    <span>{p.speed} {p.unit}</span>
                    {p.variant && <em className="compare-variant">{p.variant}</em>}
                    <small>{p.priceText}/mês</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={i} className={plans[i].featured ? "is-featured" : ""}>
                      {v === true ? (
                        <span className="compare-yes"><Check size={16} aria-hidden="true" /><span className="sr-only">Incluso</span></span>
                      ) : v === false ? (
                        <span className="compare-no"><Minus size={18} aria-hidden="true" /><span className="sr-only">Não incluso</span></span>
                      ) : (
                        <strong>{v}</strong>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                {plans.map((p) => (
                  <td key={p.id} className={p.featured ? "is-featured" : ""}>
                    <button type="button" className={`btn btn--sm ${p.featured ? "btn--primary" : "btn--ghost"}`} onClick={() => openPlan(p.id)}>
                      Escolher
                    </button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
