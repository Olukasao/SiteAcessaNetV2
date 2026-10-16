import { getNoticeVisual } from "./noticeVisuals";

export default function NoticeCard({ notice }) {
  const visual = getNoticeVisual(notice.type);
  const Icon = visual.icon;

  return (
    <section className={`central-notice-card tone-${visual.tone}`}>
      {notice.imageUrl ? <img className="central-notice-card-image" src={notice.imageUrl} alt="" /> : null}
      <div className="central-notice-card-body">
        <div className="central-notice-card-icon">
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="central-notice-card-copy">
          <strong>{notice.title}</strong>
          <p>{notice.message}</p>
        </div>
      </div>
    </section>
  );
}
