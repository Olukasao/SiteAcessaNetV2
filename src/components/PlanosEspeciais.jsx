import "../styles/components-styles/planosEspeciais.css";
import { FaGift, FaWhatsapp, FaStar } from "react-icons/fa";

const planosEspeciais = [
  {
    nome: "Promoção Carnaval",
    velocidade: "600 Mega",
    preco: "89,90",
    tag: "LIMITADO",
    cor: "carnaval",
  },
  {
    nome: "Especial Páscoa",
    velocidade: "800 Mega",
    preco: "99,90",
    tag: "OFERTA",
    cor: "pascoa",
  },
  {
    nome: "Natal Premiado",
    velocidade: "1 Giga",
    preco: "119,90",
    tag: "EXCLUSIVO",
    cor: "natal",
  },
];

export default function PlanosEspeciais() {
  return (
    <section className="planos-especiais">

      <div className="container">

        <h2>
          <FaGift /> Planos Especiais
        </h2>

        <p className="subtitle">
          Promoções exclusivas em datas comemorativas para você aproveitar mais.
        </p>

        <div className="especial-grid">
          {planosEspeciais.map((plano, i) => (
            <div key={i} className={`especial-card ${plano.cor}`}>

              <div className="tag">
                <FaStar /> {plano.tag}
              </div>

              <h3>{plano.nome}</h3>

              <span className="velocidade">
                {plano.velocidade}
              </span>

              <div className="preco">
                R$ {plano.preco}
                <small>/mês</small>
              </div>

              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                className="btn-especial"
              >
                <FaWhatsapp />
                Contratar Agora
              </a>

            </div>
          ))}
        </div>

      </div>

    </section>
  );
}