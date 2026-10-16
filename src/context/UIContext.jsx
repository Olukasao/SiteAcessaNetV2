import { createContext, useCallback, useContext, useMemo, useState } from "react";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [planId, setPlanId] = useState(null);
  // "details" mostra o plano; "form" abre direto o pedido de assinatura.
  const [planStep, setPlanStep] = useState("details");
  const [coverageOpen, setCoverageOpen] = useState(false);
  // Resultado da última consulta de cobertura -- reaproveitado na mensagem
  // de contratação pelo WhatsApp (o atendente já recebe CEP + cidade).
  const [coverage, setCoverage] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);

  const openPlan = useCallback((id, step = "details") => {
    setPlanStep(step);
    setPlanId(id);
  }, []);
  const closePlan = useCallback(() => setPlanId(null), []);
  const openCoverage = useCallback((afterPlanId = null) => {
    setPendingPlan(afterPlanId);
    setCoverageOpen(true);
  }, []);
  const closeCoverage = useCallback(() => setCoverageOpen(false), []);

  const value = useMemo(
    () => ({ planId, planStep, setPlanStep, openPlan, closePlan, coverageOpen, openCoverage, closeCoverage, coverage, setCoverage, pendingPlan, setPendingPlan }),
    [planId, planStep, openPlan, closePlan, coverageOpen, openCoverage, closeCoverage, coverage, pendingPlan]
  );
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUI() {
  return useContext(UIContext);
}
