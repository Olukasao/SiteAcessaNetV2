import "../styles/pagePlanos.css";
import { FaWifi, FaTv, FaWhatsapp, FaRocket } from "react-icons/fa";

const planos = [
  {
    nome: "400 MEGA",
    preco: "79,90",
    destaque: false,
    beneficios: ["Internet Fibra Óptica", "Wi-Fi Grátis", "Suporte Rápido"],
  },
  {
    nome: "700 MEGA",
    preco: "99,90",
    destaque: true,
    beneficios: [
      "Internet Fibra Óptica",
      "Watch TV Incluso",
      "Instalação Grátis",
      "APP de leitura Vamolê!",
    ],
  },
  {
    nome: "700 MEGA",
    preco: "129,90",
    destaque: false,
    beneficios: [
      "Ultra Velocidade",
      "Watch TV Premium",
      "Ideal para Gamers",
    ],
  },
];

const planosEspeciais = [
  { nome: "Promo Carnaval 🎉", desc: "Instalação grátis + 1 mês bônus" },
  { nome: "Promo Páscoa 🐰", desc: "Upgrade de velocidade por 3 meses" },
  { nome: "Promo Natal 🎄", desc: "Watch TV Premium incluso" },
];

export default function Planos() {
  return (
    <section className="planos">

      <div className="planos-hero">
        <h1>Escolha seu Plano</h1>
        <p>Internet rápida, estável e com entretenimento completo.</p>
      </div>

      {/* PLANOS */}
      <div className="container planos-grid">
        {planos.map((plano, i) => (
          <div
            key={i}
            className={`plano-card ${plano.destaque ? "destaque" : ""}`}
          >
            {plano.destaque && <span className="badge">MAIS CONTRATADO</span>}

            <h2>{plano.nome}</h2>

            <div className="preco">
              <span>R$</span>
              {plano.preco}
              <small>/mês</small>
            </div>

            <ul>
              {plano.beneficios.map((b, index) => (
                <li key={index}>
                  <FaWifi /> {b}
                </li>
              ))}
            </ul>

            <a
              href={`https://wa.me/5508004445799?text=Olá! Gostaria de contratar o plano de ${plano.nome} por ${plano.preco}` }
              target="_blank"
              className="btn-contratar"
            >
              <FaWhatsapp /> Contratar
            </a>
          </div>
        ))}
      </div>

      {/* PLANOS ESPECIAIS */}
      <div className="container especiais">
        <h2>Planos Especiais</h2>

        <div className="especiais-grid">
          {planosEspeciais.map((p, i) => (
            <div key={i} className="especial-card">
              <FaRocket />
              <h3>{p.nome}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}