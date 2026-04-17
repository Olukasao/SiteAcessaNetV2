import "../styles/components-styles/planosEspeciais.css";
import { FaGift, FaWhatsapp, FaStar } from "react-icons/fa";

const planosEspeciais = [

  {
    nome: "Especial Páscoa",
    velocidade: "400 Mega",
    preco: "74,99",
    tag: "OFERTA",
    cor: "pascoa",
  },
  {
    nome: "Especial Páscoa",
    velocidade: "700 Mega",
    preco: "94,99",
    tag: "OFERTA",
    cor: "pascoa",
  },
  {
    nome: "Especial Páscoa ",
    velocidade: "700 Mega + TV",
    preco: "144,99",
    icons: "",
    tag: "OFERTA",
    cor: "pascoa",
  },
];

export default function PlanosEspeciais() {
  return (
    <section className="planos-especiais">

      <div className="container">

        <h2 style={{ color: "#ffff" }}>
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