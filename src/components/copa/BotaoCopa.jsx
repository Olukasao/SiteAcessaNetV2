import "./BotaoCopa.css";

export default function OfferButton() {
  return (
    <a href="#promocao" className="offer-button">
      <div className="offer-mega">
        <strong>700</strong>
        <span>MEGA</span>
      </div>

      <div className="offer-divider"></div>

      <div className="offer-watch">
        <h3>
          <span>+</span> WATCH TV
        </h3>
        <p>
          CANAIS AO VIVO,
          <br />
          FILMES, SÉRIES
          <br />
          E MUITO MAIS!
        </p>
      </div>

      <div className="offer-price">
        <small>Por apenas</small>

        <div className="price-row">
          <span className="currency">R$</span>
          <strong>
            149<span>,99</span>
          </strong>
        </div>

        <p>/mês</p>
      </div>
    </a>
  );
}