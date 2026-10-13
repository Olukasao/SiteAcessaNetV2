import { ArrowRight } from "lucide-react";
import Dialog from "./Dialog";
import CoverageForm from "./CoverageForm";
import { useUI } from "../context/UIContext";
import { plans } from "../data/site";
import { contractLink } from "../lib/contract";

export default function CoverageModal() {
  const { coverageOpen, closeCoverage, coverage, pendingPlan, openPlan } = useUI();
  const plan = plans.find((p) => p.id === pendingPlan);

  return (
    <Dialog
      open={coverageOpen}
      onClose={closeCoverage}
      title="Consultar cobertura"
      description="Informe seu CEP e veja se a fibra AcessaNet já chega na sua cidade."
    >
      <div style={{ marginTop: 24 }}>
        <CoverageForm />
      </div>

      {coverage?.status === "ok" && (
        <div className="coverage-next">
          {plan ? (
            <a className="btn btn--primary btn--block" href={contractLink(plan, coverage)} target="_blank" rel="noreferrer">
              Contratar {plan.name} pelo WhatsApp <ArrowRight size={18} aria-hidden="true" />
            </a>
          ) : (
            <div className="coverage-next-plans">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    closeCoverage();
                    openPlan(p.id);
                  }}
                >
                  {p.short} · {p.priceText}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
