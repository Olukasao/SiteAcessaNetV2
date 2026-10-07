import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, HandCoins, X } from "lucide-react";
import { ClienteApiError, requestPaymentPromise } from "../../services/clienteApi";
import { formatCurrency } from "../../utils/format";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function formatDate(value) {
  if (!value) return "indisponível";
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "indisponível" : new Intl.DateTimeFormat("pt-BR").format(date);
}

/** Mensagem de erro de TRANSPORTE (SGP fora do ar, rate limit, duas abas ao mesmo tempo) -- recusa de NEGOCIO (contrato nao elegivel etc.) vem em outcome.message, ja traduzida pelo backend, nunca cai aqui. */
function transportErrorMessage(error) {
  if (error instanceof ClienteApiError) {
    if (error.code === "SGP_REQUEST_FAILED") {
      return "Não foi possível solicitar a promessa de pagamento agora. Tente novamente em alguns minutos.";
    }
    if (error.code === "RATE_LIMITED" || error.code === "PROMISE_IN_PROGRESS") {
      return error.message;
    }
  }
  return "Não foi possível solicitar a promessa de pagamento agora. Tente novamente em alguns minutos.";
}

/**
 * Modal de confirmação + execução da promessa de pagamento (liberação por confiança).
 * Sempre chama o SGP de verdade via requestPaymentPromise -- nunca simula sucesso/loading
 * falso. Três estados: confirm -> loading -> result (sucesso ou recusa/erro).
 */
export default function PaymentPromiseModal({ contractId, invoice, onClose, onSuccess, open }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [state, setState] = useState("confirm");
  const [outcome, setOutcome] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setState("confirm");
    setOutcome(null);
    setErrorMessage("");
    previousFocusRef.current = document.activeElement;
    dialogRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape" && state !== "loading") {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) {
    return null;
  }

  function handleBackdropClick() {
    if (state !== "loading") {
      onClose();
    }
  }

  async function handleConfirm() {
    setState("loading");
    setErrorMessage("");
    try {
      const result = await requestPaymentPromise(contractId);
      setOutcome(result);
      setState("result");
      if (result.released) {
        onSuccess?.();
      }
    } catch (error) {
      setErrorMessage(transportErrorMessage(error));
      setState("result");
    }
  }

  return (
    <div className="promise-modal-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        aria-labelledby="promise-modal-title"
        aria-modal="true"
        className="promise-modal"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {state !== "loading" ? (
          <button aria-label="Fechar" className="promise-modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        ) : null}

        {state === "confirm" ? (
          <>
            <div className="promise-modal-icon">
              <HandCoins size={28} aria-hidden="true" />
            </div>
            <h2 id="promise-modal-title">Promessa de pagamento</h2>
            <p>
              Ao confirmar, solicitaremos ao sistema a liberação temporária do seu serviço,
              conforme as regras do seu contrato.
            </p>
            <p className="promise-modal-disclaimer">
              Essa opção <strong>não cancela</strong> a fatura nem altera o valor devido. A
              disponibilidade depende da situação financeira e das regras do seu contrato.
            </p>

            <dl className="promise-modal-details">
              <div>
                <dt>Contrato</dt>
                <dd>{contractId}</dd>
              </div>
              <div>
                <dt>Fatura vencida</dt>
                <dd>{formatCurrency(invoice?.amount) || "indisponível"}</dd>
              </div>
              <div>
                <dt>Vencimento</dt>
                <dd>{formatDate(invoice?.dueDate)}</dd>
              </div>
            </dl>

            <div className="promise-modal-actions">
              <button className="home-btn home-btn-primary" onClick={handleConfirm} type="button">
                Confirmar promessa
              </button>
              <button className="home-btn home-btn-ghost" onClick={onClose} type="button">
                Cancelar
              </button>
            </div>
          </>
        ) : null}

        {state === "loading" ? (
          <>
            <div className="promise-modal-icon">
              <HandCoins size={28} aria-hidden="true" />
            </div>
            <h2 id="promise-modal-title">Solicitando promessa de pagamento…</h2>
            <p>Aguarde, estamos consultando o sistema. Não feche esta janela.</p>
          </>
        ) : null}

        {state === "result" && outcome?.released ? (
          <>
            <div className="promise-modal-icon promise-modal-icon--success">
              <CheckCircle2 size={28} aria-hidden="true" />
            </div>
            <h2 id="promise-modal-title">Promessa de pagamento realizada</h2>
            <p>Sua solicitação foi registrada com sucesso.</p>
            <dl className="promise-modal-details">
              {outcome.protocol ? (
                <div>
                  <dt>Protocolo</dt>
                  <dd>{outcome.protocol}</dd>
                </div>
              ) : null}
              {typeof outcome.releasedDays === "number" ? (
                <div>
                  <dt>Liberação temporária</dt>
                  <dd>
                    {outcome.releasedDays} {outcome.releasedDays === 1 ? "dia" : "dias"}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="promise-modal-disclaimer">
              Seu serviço foi liberado temporariamente conforme as regras do contrato. A
              fatura continua em aberto e deve ser paga normalmente.
            </p>
            <div className="promise-modal-actions">
              <button className="home-btn home-btn-primary" onClick={onClose} type="button">
                Entendi
              </button>
            </div>
          </>
        ) : null}

        {state === "result" && outcome && !outcome.released ? (
          <>
            <div className="promise-modal-icon promise-modal-icon--warning">
              <AlertTriangle size={28} aria-hidden="true" />
            </div>
            <h2 id="promise-modal-title">Promessa indisponível</h2>
            <p>{outcome.message}</p>
            <p className="promise-modal-disclaimer">
              Se precisar de ajuda, entre em contato com nosso atendimento.
            </p>
            <div className="promise-modal-actions">
              <button className="home-btn home-btn-ghost" onClick={onClose} type="button">
                Fechar
              </button>
            </div>
          </>
        ) : null}

        {state === "result" && !outcome && errorMessage ? (
          <>
            <div className="promise-modal-icon promise-modal-icon--warning">
              <AlertTriangle size={28} aria-hidden="true" />
            </div>
            <h2 id="promise-modal-title">Não foi possível concluir</h2>
            <p>{errorMessage}</p>
            <div className="promise-modal-actions">
              <button className="home-btn home-btn-ghost" onClick={onClose} type="button">
                Fechar
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
