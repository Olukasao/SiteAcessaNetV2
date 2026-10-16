import { X } from "lucide-react";
import { getNoticeVisual } from "./noticeVisuals";

/** Empilha um por aviso -- nunca esconde a Central, so ocupa espaco no topo. */
export default function NoticeBanner({ notice, onDismiss }) {
  const visual = getNoticeVisual(notice.type);
  const Icon = visual.icon;

  return (
    <div className={`central-notice-banner tone-${visual.tone}`} role="status">
      {notice.imageUrl ? (
        <img className="central-notice-banner-thumb" src={notice.imageUrl} alt="" />
      ) : (
        <Icon size={18} aria-hidden="true" />
      )}
      <div className="central-notice-banner-copy">
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </div>
      {notice.dismissible ? (
        <button
          type="button"
          className="central-notice-banner-close"
          aria-label="Fechar aviso"
          onClick={() => onDismiss(notice)}
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
