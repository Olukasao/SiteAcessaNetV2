import "./awarenessCard.css";

function renderTitle(title, highlight) {
  if (!highlight) return title;

  const index = title.indexOf(highlight);
  if (index === -1) return title;

  return (
    <>
      {title.slice(0, index)}
      <strong className="awareness-card-highlight">{highlight}</strong>
      {title.slice(index + highlight.length)}
    </>
  );
}

export default function AwarenessCard({
  icon: Icon,
  title,
  highlight,
  text,
  large = false,
  className = "",
}) {
  return (
    <div
      className={`awareness-card${large ? " awareness-card--large" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="awareness-card-icon" aria-hidden="true">
        <Icon size={24} strokeWidth={2} />
      </div>

      <div className="awareness-card-content">
        <h3>{renderTitle(title, highlight)}</h3>
        <span className="awareness-card-line" aria-hidden="true" />
        <p>{text}</p>
      </div>
    </div>
  );
}
