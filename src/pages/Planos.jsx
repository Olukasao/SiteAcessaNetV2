import "../styles/pagePlanos.css";
import { FaWifi, FaTv, FaWhatsapp, FaRocket } from "react-icons/fa";
import logoWatch from "../assets/watchTV.jpg"
import logoTemSaude from "../assets/temSaude.png"
import logoVamoLe from "../assets/vamoLe.png"

import TemaSection from "../components/especial/TemaSection";





const planos = [
  {
    nome: "400 MEGA",
    preco: "79,99",
    destaque: false,
    beneficios: ["Internet Fibra Óptica", "Wi-Fi Grátis", "Suporte Rápido"],
    servicos: [
      { src: logoVamoLe, fundo: true }
    ]
  },
  {
    nome: "700 MEGA",
    preco: "99,90",
    destaque: false,
    beneficios: [
      "Internet Fibra Óptica",
      "Watch TV Incluso",
      "Instalação Grátis",
      "APP de leitura Vamolê!",
    ],
    servicos: [
      { src: logoVamoLe, fundo: true }
    ]
  },
  {
    nome: "700 MEGA + TV",
    preco: "149,90",
    destaque: true,
    beneficios: [
      "Ultra Velocidade",
      "Watch TV Premium",
      "Ideal para Gamers",
    ],
    servicos: [
      { src: logoTemSaude, fundo: false },
      { src: logoWatch, fundo: false },
      { src: logoVamoLe, fundo: true }
    ]
  },

];

export default function Planos() {
  return (
    <>

      <section className="planos-containers">
        <div className="planos-hero-container">
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
                href={`https://wa.me/5508004445799?text=Olá! Gostaria de contratar o plano de ${plano.nome} por ${plano.preco}`}
                target="_blank"
                className="btn-contratar"
              >
                <FaWhatsapp /> Contratar
              </a>
            </div>
          ))}
        </div>

        {/* PLANOS ESPECIAIS */}
          <TemaSection/>

      </section>

      <section className="corp">
        <div className="corp-wrap">

          {/* TEXTO */}
          <div className="corp-left">
            <span className="corp-label">Empresas</span>

            <h2>
              Internet estável para quem não pode parar
            </h2>

            <p>
              Escolha entre um plano comercial para o dia a dia ou um link dedicado
              com garantia total de banda e suporte prioritário.
            </p>

            <div className="corp-actions">
              <a
                href="https://wa.me/5508004445799?text=Olá! Gostaria de um plano corporativo"
                target="_blank"
                className="primary"
              >
                <FaWhatsapp /> Falar com especialista
              </a>

            </div>
          </div>

          {/* PLANOS */}
          <div className="corp-right">

            <div className="plan">
              <div className="plan-header">
                <h3>Comercial</h3>
                <span className="badge">Mais comum</span>
              </div>

              <p className="plan-desc">
                Ideal para escritórios, lojas e pequenas empresas.
              </p>

              <ul>
                <li>Alta velocidade</li>
                <li>Wi-Fi corporativo</li>
                <li>Suporte ágil</li>
              </ul>

              <div className="plan-footer">
                <span>A partir de 300 Mega</span>
              </div>
            </div>

            <div className="plan highlight">
              <div className="plan-header">
                <h3>Dedicado</h3>
                <span className="badge strong">Performance máxima</span>
              </div>

              <p className="plan-desc">
                Para operações críticas que exigem estabilidade total.
              </p>

              <ul>
                <li>Banda 100% garantida</li>
                <li>IP fixo</li>
                <li>SLA com prioridade</li>
              </ul>

              <div className="plan-footer">
                <span>Sob consulta</span>
              </div>
            </div>

          </div>

        </div>
      </section>
    </>
  );
}