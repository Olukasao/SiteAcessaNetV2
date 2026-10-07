import { useEffect, useRef } from "react";
import { FileSignature, X } from "lucide-react";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Aviso pos-login de assinatura pendente -- nunca bloqueia a Central
 * (sempre fechavel com X/"Agora não"). Uma pendencia mostra direto; varias
 * mostram um resumo + atalho para a lista completa.
 */
export default function SignaturePendingModal({ onClose, onSignNow, onViewAll, open, signatures }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const first = signatures[0];
  const hasMultiple = signatures.length > 1;

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

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
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

  if (!open || !first) {
    return null;
  }

  return (
    <div className="signature-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-labelledby="signature-modal-title"
        aria-modal="true"
        className="signature-modal"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button aria-label="Fechar" className="signature-modal-close" onClick={onClose} type="button">
          <X size={18} />
        </button>

        <div className="signature-modal-icon">
          <FileSignature size={28} aria-hidden="true" />
        </div>

        {hasMultiple ? (
          <>
            <h2 id="signature-modal-title">Documentos aguardando assinatura</h2>
            <p>Você possui {signatures.length} documentos que ainda precisam da sua assinatura.</p>
            <ul className="signature-modal-list">
              {signatures.slice(0, 3).map((signature) => (
                <li key={signature.id}>{signature.title}</li>
              ))}
            </ul>
            <div className="signature-modal-actions">
              <button className="home-btn home-btn-primary" onClick={onViewAll} type="button">
                Ver todas as assinaturas
              </button>
              <button className="home-btn home-btn-ghost" onClick={onClose} type="button">
                Agora não
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="signature-modal-title">Documento aguardando assinatura</h2>
            <p>Você possui um documento que ainda precisa ser assinado.</p>
            <div className="signature-modal-document">
              <strong>{first.title}</strong>
              <span>Contrato nº {first.contractId}</span>
            </div>
            <p className="signature-modal-hint">Para manter seus documentos atualizados, conclua a assinatura.</p>
            {first.signKey ? (
              <p className="signature-modal-hint">
                Código de verificação: <strong>{first.signKey}</strong>
              </p>
            ) : null}
            <div className="signature-modal-actions">
              <button className="home-btn home-btn-primary" onClick={() => onSignNow(first)} type="button">
                Assinar agora
              </button>
              <button className="home-btn home-btn-ghost" onClick={onViewAll} type="button">
                Ver detalhes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
