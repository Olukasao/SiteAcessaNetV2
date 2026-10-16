import { FileSignature } from "lucide-react";

/** Persistente enquanto houver pendencia real -- nunca dismissible (so some quando uma nova consulta ao backend confirmar que nao ha mais pendencia). */
export default function SignaturePendingBanner({ count, onSignNow }) {
  return (
    <div className="signature-banner" role="status">
      <FileSignature size={20} aria-hidden="true" />
      <div className="signature-banner-copy">
        <strong>Assinatura pendente</strong>
        <span>
          {count > 1
            ? `Você possui ${count} documentos aguardando sua assinatura.`
            : "Você possui um documento aguardando sua assinatura."}
        </span>
      </div>
      <button className="signature-banner-action" onClick={onSignNow} type="button">
        Assinar agora
      </button>
    </div>
  );
}
