import "./Assine.css";

export default function BotaoAssine() {
  const irParaPlanos = () => {
    window.location.href = "/planos#ofertas-tema";
  };

  return (
    <button className="botao-assine" type="button" onClick={irParaPlanos}>
      <span className="botao-assine__texto">ASSINE AGORA</span>
      <span className="botao-assine__icone">»</span>
    </button>
  );
}