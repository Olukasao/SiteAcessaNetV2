import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "../../utils/format";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal (vira bottom sheet no mobile via CSS) com os detalhes do upgrade para 800 Mega. */
export default function PlanUpgradeModal({ benefits, currentPlan, onClose, onConfirm, open, priceDifference, recommendedPlan }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    dialogRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="plano-upgrade-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-labelledby="plano-upgrade-modal-title"
        aria-modal="true"
        className="plano-upgrade-modal"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="Fechar"
          className="plano-upgrade-modal-close"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>

        <span className="plano-upgrade-modal-eyebrow">{recommendedPlan.speedValue} MEGA</span>
        <h2 id="plano-upgrade-modal-title">Mais velocidade para sua casa</h2>
        <p className="plano-upgrade-modal-subtitle">+ benefícios inclusos</p>

        <ul className="plano-upgrade-modal-benefits">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <li key={benefit.id}>
                <span className="plano-benefit-icon">
                  <Icon aria-hidden="true" size={18} />
                </span>
                {benefit.title}
              </li>
            );
          })}
        </ul>

        <div className="plano-upgrade-modal-compare">
          <div>
            <small>Seu plano atual</small>
            <strong>{currentPlan.speedValue ? `${currentPlan.speedValue} Mega` : currentPlan.label}</strong>
            <span>{typeof currentPlan.price === "number" ? formatCurrency(currentPlan.price) : "Consulte sua fatura"}</span>
          </div>
          <div className="plano-upgrade-modal-compare-arrow" aria-hidden="true">→</div>
          <div>
            <small>Novo plano</small>
            <strong>{recommendedPlan.speedValue} Mega</strong>
            <span>{typeof recommendedPlan.price === "number" ? formatCurrency(recommendedPlan.price) : "Consulte o valor"}</span>
          </div>
        </div>

        {typeof priceDifference === "number" ? (
          <p className="plano-upgrade-modal-diff">Diferença: +{formatCurrency(priceDifference)}/mês</p>
        ) : null}

        <div className="plano-upgrade-modal-actions">
          <button className="home-btn home-btn-primary" onClick={onConfirm} type="button">
            Quero fazer upgrade
          </button>
          <button className="home-btn home-btn-ghost" onClick={onClose} type="button">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
