import { ArrowRight } from "lucide-react";
import Dialog from "./Dialog";
import CoverageForm from "./CoverageForm";
import { useUI } from "../context/UIContext";
import { plans } from "../data/site";

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
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                closeCoverage();
                openPlan(plan.id, "form");
              }}
            >
              Contratar {plan.name} <ArrowRight size={18} aria-hidden="true" />
            </button>
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
