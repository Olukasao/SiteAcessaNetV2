import "../styles/components-styles/planos.css";
import {
  FaWifi,
  FaTv,
  FaWhatsapp,
  FaCheckCircle,
} from "react-icons/fa";

const planos = [
  {
    nome: "300 Mega",
    preco: "79,90",
    destaque: false,
    beneficios: [
      "Internet Fibra Óptica",
      "Wi-Fi Grátis",
      "Suporte 24h",
    ],
  },
  {
    nome: "600 Mega",
    preco: "99,90",
    destaque: true,
    beneficios: [
      "Internet Fibra Óptica",
      "Watch TV Incluso",
      "Wi-Fi Dual Band",
      "Suporte Prioritário",
    ],
  },
  {
    nome: "1 Giga",
    preco: "129,90",
    destaque: false,
    beneficios: [
      "Internet Ultra Rápida",
      "Watch TV Incluso",
      "Instalação Grátis",
      "Wi-Fi Premium",
    ],
  },
];

export default function Planos() {
  return (
    <section className="planos">
      <div className="planos-container">

        <h2>Nossos Planos de Internet</h2>
        <p className="subtitle">
          Velocidade, estabilidade e entretenimento completo para sua casa.
        </p>

        <div className="planos-grid">
          {planos.map((plano, i) => (
            <div
              key={i}
              className={`plano-card ${
                plano.destaque ? "destaque" : ""
              }`}
            >
              {plano.destaque && (
                <div className="badge">
                  ⭐ MAIS CONTRATADO
                </div>
              )}

              <h3>{plano.nome}</h3>

              <div className="preco">
                <span>R$</span>
                {plano.preco}
                <small>/mês</small>
              </div>

              <ul>
                {plano.beneficios.map((item, index) => (
                  <li key={index}>
                    <FaCheckCircle className="icon-check" />
                    {item.includes("Watch") && (
                      <FaTv className="icon-tv" />
                    )}
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href={`https://wa.me/5508004445799?text=Olá! Gostaria de contratar o plano de ${plano.nome} por ${plano.preco} `}
                target="_blank"
                className="btn-contratar"
              >
                <FaWhatsapp />
                Contratar via WhatsApp
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}