import "../styles/components-styles/planos.css";
import logoWatch from "../assets/watchTV.jpg"
import logoTemSaude from "../assets/temSaude.png"
import logoVamoLe from "../assets/vamoLe.png"

import {
  FaWifi,
  FaTv,
  FaWhatsapp,
  FaCheckCircle,
} from "react-icons/fa";

const planos = [
  {
    nome: "400 Mega",
    preco: "79,99",
    destaque: false,
    beneficios: [
      "Internet Fibra Óptica",
      "Wi-Fi Grátis",
      "Suporte 24h",
    ],
    servicos: [
      { src: logoVamoLe, fundo: true }
    ]
  },
  {
    nome: "700 MEGA + TV",
    preco: "149,99",
    destaque: true,
    beneficios: [
      "Internet Fibra Óptica",
      "Wi-Fi Dual Band",
      "Serviços inclusos",
    ],
    servicos: [
      { src: logoTemSaude, fundo: false },
      { src: logoWatch, fundo: false },
      { src: logoVamoLe, fundo: true }
    ]
  },
  {
    nome: "700 MEGA",
    preco: "99,99",
    destaque: false,
    beneficios: [
      "Internet Ultra Rápida",
      "Instalação Grátis",
      "Suporte 24h",
    ],
    servicos: [
      { src: logoVamoLe, fundo: true }
    ]
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
              className={`plano-card ${plano.destaque ? "destaque" : ""
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

              <div style={{ display: "flex", gap: "20px", alignItems: "center", justifyContent: "center", marginBottom: "5px" }}>
                {plano.servicos.map((item, index) => (
                  <img
                    key={index}
                    src={item.src}
                    alt=""
                    style={{
                      width: 55,
                      height: 55,
                      objectFit: "contain",
                      borderRadius: 12,
                      background: item.fundo ? "#f9f9f9" : "transparent",
                      border: item.fundo ? "1px solid #eee" : "none",
                      boxShadow: item.fundo ? "0 6px 18px rgba(0,0,0,0.15)" : "none",
                      transition: "all 0.3s ease",

                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-6px) scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 12px 25px rgba(0,0,0,0.25)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow = item.fundo
                        ? "0 6px 18px rgba(0,0,0,0.15)"
                        : "none";
                    }}
                  />
                ))}
              </div>
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