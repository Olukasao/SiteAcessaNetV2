import "./temaSection.css";
import {
  FaBookOpen,
  FaHeartbeat,
  FaPhoneAlt,
  FaPlayCircle,
  FaShieldAlt,
  FaTv,
  FaWifi,
} from "react-icons/fa";
import globoplayLogo from "../../assets/globoplay.png";

const temas = {
  destaque: {
    titulo: "Planos em destaque",
    desc: "Internet rápida e estável com entretenimento e serviços digitais para sua casa.",
    combos: [
      {
        id: "700-mbps",
        nome: "700 Mbps",
        preco: "114,99",
        beneficios: [
          {
            icon: FaWifi,
            titulo: "700 MEGA",
            descricao: "Internet Fibra Óptica",
          },
          {
            icon: FaBookOpen,
            titulo: "APP LIVROS",
            descricao: "Conteúdo para toda a família",
          },
          {
            icon: FaPlayCircle,
            logo: globoplayLogo,
            logoAlt: "Globoplay",
            titulo: "GLOBOPLAY",
            descricao: "Padrão com anúncios",
          },
        ],
      },
      {
        id: "combo-paizao",
        nome: "PLANO 800 MEGA",
        preco: "169,99",
        destaque: true,
        beneficios: [
          {
            icon: FaWifi,
            titulo: "800 MEGA",
            descricao: "Internet Fibra Óptica",
          },
          {
            icon: FaPlayCircle,
            logo: globoplayLogo,
            logoAlt: "Globoplay",
            titulo: "GLOBOPLAY",
            descricao: "Padrão com anúncios",
          },
          {
            icon: FaHeartbeat,
            titulo: "TELEMEDICINA",
            descricao: "Consultas sem sair de casa",
          },
          {
            icon: FaTv,
            titulo: "WATCH TV + PREMIERE",
            descricao: "Canais ao vivo e esportes",
          },
          {
            icon: FaPhoneAlt,
            titulo: "TELEFONE FIXO",
            descricao: "Minutagem ilimitada",
          },
        ],
      },
    ],
  },
};

export default function TemaSection({ tema = "destaque" }) {
  const data = temas[tema] || temas.destaque;

  return (
    <section id="ofertas-tema" className="tema-section">
      <div className="tema-container">
        <div className="tema-content">
          <div className="tema-texto">
            <h2>{data.titulo}</h2>
            <p>{data.desc}</p>

            <div className="tema-combos">
              {data.combos.map((combo) =>
                combo.id === "combo-paizao" ? (
                  <ComboPaizaoCard key={combo.id} combo={combo} />
                ) : (
                  <Plano700Card key={combo.id} combo={combo} />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Plano700Card({ combo }) {
  const whatsappUrl = `https://wa.me/5508004445799?text=Quero contratar o plano ${combo.nome} por R$${combo.preco}`;

  return (
    <div id="plano-700-card" className="combo-card combo-700-card">
      <div className="combo-700-main">
        <div className="combo-paizao-heading combo-700-heading">
          <h3 className="combo-paizao-title combo-700-title">
            <span>PLANO</span>
            <span>700 MEGA</span>
          </h3>
        </div>

        <p className="combo-paizao-subtitle combo-700-subtitle">
          Internet rápida e estável<br />
          para aproveitar <strong>todos os momentos.</strong>
        </p>

        <ul className="combo-paizao-benefits combo-700-benefits">
          {combo.beneficios.map((beneficio) => {
            const Icon = beneficio.icon;

            return (
              <li key={beneficio.titulo}>
                <span className="combo-paizao-benefit-icon" aria-hidden="true">
                  {beneficio.logo ? (
                    <img src={beneficio.logo} alt="" className="combo-paizao-benefit-logo" />
                  ) : (
                    <Icon />
                  )}
                </span>
                <span className="combo-paizao-benefit-copy">
                  <strong>{beneficio.titulo}</strong>
                  <small>{beneficio.descricao}</small>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="combo-700-footer">
        <div className="combo-paizao-price-box combo-700-price-box">
          <div className="combo-price-now">
            <span className="combo-price-kicker">POR APENAS</span>
            <div className="combo-price-value">
              <span className="combo-price-currency">R$</span>
              <strong>114</strong>
              <span className="combo-price-cents">,99</span>
              <span className="combo-price-period">/mês</span>
            </div>
          </div>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-combo combo-paizao-button combo-700-button"
          aria-label={`Contratar plano ${combo.nome} por R$ ${combo.preco} por mês`}
        >
          Contratar agora
        </a>

        <p className="combo-paizao-note combo-700-note">
          <FaShieldAlt aria-hidden="true" />
          <span>Para novos assinantes</span>
        </p>
      </div>
    </div>
  );
}

function ComboPaizaoCard({ combo }) {
  const whatsappUrl = `https://wa.me/5508004445799?text=Quero contratar o plano ${combo.nome} por R$${combo.preco}`;

  return (
    <div id="combo-paizao-card" className="combo-card combo-paizao-card">
      <span className="combo-badge combo-paizao-badge">
        OFERTA ESPECIAL
      </span>

      <div className="combo-paizao-heading">
        <h3 className="combo-paizao-title combo-800-title">
          <span>PLANO</span>
          <span>800 MEGA</span>
        </h3>
      </div>

      <p className="combo-paizao-subtitle">
        Mais conexão e entretenimento<br />
        para <strong>toda a família.</strong>
      </p>

      <ul className="combo-paizao-benefits">
        {combo.beneficios.map((beneficio) => {
          const Icon = beneficio.icon;

          return (
            <li key={beneficio.titulo}>
              <span className="combo-paizao-benefit-icon" aria-hidden="true">
                {beneficio.logo ? (
                  <img src={beneficio.logo} alt="" className="combo-paizao-benefit-logo" />
                ) : (
                  <Icon />
                )}
              </span>
              <span className="combo-paizao-benefit-copy">
                <strong>{beneficio.titulo}</strong>
                <small>{beneficio.descricao}</small>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="combo-paizao-price-box">
        <div className="combo-price-now">
          <span className="combo-price-kicker">POR APENAS</span>
          <div className="combo-price-value">
            <span className="combo-price-currency">R$</span>
            <strong>169</strong>
            <span className="combo-price-cents">,99</span>
            <span className="combo-price-period">/mês</span>
          </div>
        </div>
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="btn-combo combo-paizao-button"
        aria-label="Contratar agora o plano 800 MEGA por R$ 169,99 por mês"
      >
        Contratar agora
      </a>

      <p className="combo-paizao-note">
        <FaShieldAlt aria-hidden="true" />
        <span>Para novos assinantes</span>
      </p>
    </div>
  );
}
