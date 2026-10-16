import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { getNoticeVisual } from "./noticeVisuals";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Um aviso por vez -- a fila (varios avisos criticos) e controlada pelo componente pai, que troca `notice` conforme cada um e dispensado. */
export default function NoticeModal({ notice, onDismiss }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    dialogRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape" && notice.dismissible) {
        onDismiss(notice);
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
  }, [notice, onDismiss]);

  const visual = getNoticeVisual(notice.type);
  const Icon = visual.icon;

  return (
    <div
      className="central-notice-modal-backdrop"
      role="presentation"
      onClick={() => notice.dismissible && onDismiss(notice)}
    >
      <div
        ref={dialogRef}
        className={`central-notice-modal tone-${visual.tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="central-notice-modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {notice.dismissible ? (
          <button
            type="button"
            className="central-notice-modal-close"
            aria-label="Fechar aviso"
            onClick={() => onDismiss(notice)}
          >
            <X size={18} />
          </button>
        ) : null}
        {notice.imageUrl ? (
          <img className="central-notice-modal-image" src={notice.imageUrl} alt="" />
        ) : (
          <div className="central-notice-modal-icon">
            <Icon size={28} aria-hidden="true" />
          </div>
        )}
        <h2 id="central-notice-modal-title">{notice.title}</h2>
        <p>{notice.message}</p>
        <button type="button" className="central-notice-modal-confirm" onClick={() => onDismiss(notice)}>
          Entendi
        </button>
      </div>
    </div>
  );
}
