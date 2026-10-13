import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import "./dialog.css";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Modal acessível: role=dialog + aria-modal, foco preso, Esc fecha, foco
// volta pro elemento que abriu, scroll do body travado. Em telas pequenas
// vira "sheet" vindo de baixo.
export default function Dialog({ open, onClose, title, description, children, size = "md" }) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const lastFocus = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector("[data-autofocus]") || panelRef.current?.querySelector(FOCUSABLE);
      first?.focus();
    }, 30);

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);

  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 40, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.22 } },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="dialog-root" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none", transition: { duration: 0.22 } }}>
          <motion.div
            className="dialog-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={panelRef}
            className={`dialog-panel dialog-panel--${size}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            {...panelMotion}
          >
            <button type="button" className="dialog-close" onClick={onClose} aria-label="Fechar">
              <X size={20} />
            </button>
            <h2 id={titleId} className="dialog-title">{title}</h2>
            {description && <p id={descId} className="dialog-desc">{description}</p>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
