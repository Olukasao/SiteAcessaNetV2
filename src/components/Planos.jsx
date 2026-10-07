import "../styles/components-styles/planos.css";
import { FaCheckCircle, FaWhatsapp, FaWifi } from "react-icons/fa";
import planosData from "../data/planosData";
import BeneficioItem from "./BeneficioItem";

const planos = planosData;

export default function Planos() {
  return (
    <section className="planos" id="planos-home">
      <div className="planos-container">
        <span className="planos-label">
          <FaWifi /> Internet residencial
        </span>

        <h2>Escolha seu Plano</h2>
        <p className="subtitle">
          Planos em destaque com fibra óptica, entretenimento e serviços digitais.
        </p>

        <div className="planos-grid">
          {planos.map((plano) => (
            <article
              key={plano.nome}
              className={`plano-card ${plano.destaque ? "destaque" : ""} ${plano.cardClass || ""}`.trim()}
            >
              {plano.destaque && (
                <span className="plan-badge">MAIS CONTRATADO</span>
              )}

              <h3>{plano.nome}</h3>

              <div className="preco">
                <span>R$</span>
                {plano.preco}
                <small>/mês</small>
              </div>

              <ul>
                {plano.beneficios.map((beneficio) => (
                  <li key={beneficio}>
                    <FaCheckCircle className="icon-check" /> <BeneficioItem texto={beneficio} />
                  </li>
                ))}
              </ul>

              <div className="plan-services">
                {plano.servicos.map((servico) => (
                  <span
                    key={servico.nome}
                    className={servico.fundo ? "service-logo dark" : "service-logo"}
                  >
                    <img
                      src={servico.src}
                      alt={servico.nome}
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                ))}
              </div>

              <a
                href={`https://wa.me/5508004445799?text=Olá! Gostaria de contratar o plano de ${plano.nome} por ${plano.preco}`}
                target="_blank"
                rel="noreferrer"
                className="btn-contratar"
              >
                <FaWhatsapp /> Contratar
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
