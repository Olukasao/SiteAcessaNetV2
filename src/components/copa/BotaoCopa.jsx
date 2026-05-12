import "./BotaoCopa.css";

export default function BotaoCopa() {
  const irParaPlanos = () => {
    window.location.href = "/planos#ofertas-tema";
  };

  return (
    <button className="botao-copa" type="button" onClick={irParaPlanos}>
      <div className="botao-copa__left">
        <div className="botao-copa__700">700</div>
        <div className="botao-copa__mega">MEGA</div>
      </div>

      <div className="botao-copa__middle">
        <div className="botao-copa__watch-row">
          <span className="botao-copa__plus">+</span>
          <span className="botao-copa__watch">WATCH TV</span>
        </div>

        <div className="botao-copa__desc">
          CANAIS AO VIVO,
          <br />
          FILMES, SÉRIES
          <br />
          E MUITO MAIS!
        </div>
      </div>

      <div className="botao-copa__price-box">
        <div className="botao-copa__price-top">Por apenas</div>

        <div className="botao-copa__price-row">
          <span className="botao-copa__currency">R$</span>
          <span className="botao-copa__price-main">149</span>

          <div className="botao-copa__price-side">
            <span className="botao-copa__cents">,99</span>
            <span className="botao-copa__month">/mês</span>
          </div>
        </div>
      </div>
    </button>
  );
}
