import "./beneficioItem.css";

export default function BeneficioItem({ texto }) {
  const isGloboplay = texto === "Globoplay";

  return (
    <span className={`beneficio-text ${isGloboplay ? "beneficio-globoplay" : ""}`}>
      <span className="beneficio-label">{texto}</span>
      {isGloboplay && (
        <span className="beneficio-nota" aria-label="padrão com anúncios">
          (*padrão com anúncios)
        </span>
      )}
    </span>
  );
}
