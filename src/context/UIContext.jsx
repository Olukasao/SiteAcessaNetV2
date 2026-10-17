import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const navigate = useNavigate();
  const [planId, setPlanId] = useState(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  // Resultado da última consulta de cobertura -- reaproveitado na mensagem
  // de contratação pelo WhatsApp e no endereço da página /contratar.
  const [coverage, setCoverage] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);

  // "details" abre o modal do plano; "form" leva à solicitação de
  // contratação online (/contratar), fechando qualquer modal aberto.
  const openPlan = useCallback(
    (id, step = "details") => {
      if (step === "form") {
        setPlanId(null);
        setCoverageOpen(false);
        navigate(`/contratar?plano=${encodeURIComponent(id)}`);
        return;
      }
      setPlanId(id);
    },
    [navigate]
  );
  const closePlan = useCallback(() => setPlanId(null), []);
  const openCoverage = useCallback((afterPlanId = null) => {
    setPendingPlan(afterPlanId);
    setCoverageOpen(true);
  }, []);
  const closeCoverage = useCallback(() => setCoverageOpen(false), []);

  const value = useMemo(
    () => ({ planId, openPlan, closePlan, coverageOpen, openCoverage, closeCoverage, coverage, setCoverage, pendingPlan, setPendingPlan }),
    [planId, openPlan, closePlan, coverageOpen, openCoverage, closeCoverage, coverage, pendingPlan]
  );
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUI() {
  return useContext(UIContext);
}
