import { useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaChevronDown,
  FaExchangeAlt,
  FaHeadset,
  FaInfoCircle,
  FaShieldAlt,
  FaTimes,
  FaVolumeUp,
  FaWhatsapp,
} from "react-icons/fa";
import telefoneFixoImage from "../assets/telefone-fixo-transparente.png";
import {
  fixedLineFaqs,
  fixedLinePlan,
  formatFixedLinePrice,
  getFixedLineConditions,
  getFixedLinePriceParts,
  getFixedLineWhatsappMessages,
  getFixedLineWhatsappUrl,
} from "../data/linhaFixaData";
import "../styles/components-styles/linhaFixaSection.css";

const featuredBenefits = ["Minutagem Ilimitada", "Estável", "Suporte dedicado"];

function renderBenefitIcon(benefit) {
  if (benefit === "Minutagem Ilimitada") return <FaVolumeUp />;
  if (benefit === "Estável") return <FaShieldAlt />;
  return <FaHeadset />;
}

export default function LinhaFixaSection({ source = "home" }) {
  const isPlanosPage = source === "planos";
  const [isConditionsOpen, setIsConditionsOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  const priceText = useMemo(() => formatFixedLinePrice(fixedLinePlan.price), []);
  const priceParts = useMemo(() => getFixedLinePriceParts(fixedLinePlan.price), []);
  const whatsappMessages = useMemo(() => getFixedLineWhatsappMessages(priceText), [priceText]);
  const conditions = useMemo(() => getFixedLineConditions(priceText), [priceText]);

  useEffect(() => {
    if (!isConditionsOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsConditionsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isConditionsOpen]);

  const toggleItem = (itemId) => {
    setActiveItem((current) => (current === itemId ? null : itemId));
  };

  return (
    <section
      id="linha-fixa"
      className={`linha-fixa-section ${isPlanosPage ? "linha-fixa-section--full" : "linha-fixa-section--home"}`}
    >
      <div className="linha-fixa-container">
        <div className="linha-fixa-main">
          <div className="linha-fixa-copy">
            <div className="linha-fixa-kickers">
              <span className="linha-fixa-tag">{fixedLinePlan.serviceTag}</span>
              <span className="linha-fixa-new">{fixedLinePlan.badge}</span>
            </div>

            <h2>{fixedLinePlan.title}</h2>
            <p className="linha-fixa-subtitle">{fixedLinePlan.subtitle}</p>

            <div className="linha-fixa-commerce">
              <div className="linha-fixa-price" aria-label={`${fixedLinePlan.name} por ${priceText} por mês`}>
                <span>{fixedLinePlan.pricePrefix}</span>
                <div>
                  <small>R$</small>
                  <strong>{priceParts.integer}</strong>
                  <small>,{priceParts.cents}</small>
                  <em>{fixedLinePlan.period}</em>
                </div>
              </div>

              <div className="linha-fixa-primary-actions linha-fixa-primary-actions--single">
                <a
                  href={getFixedLineWhatsappUrl(whatsappMessages.contract)}
                  target="_blank"
                  rel="noreferrer"
                  className="linha-fixa-btn linha-fixa-btn--primary"
                >
                  <FaWhatsapp /> Contratar
                </a>
              </div>
            </div>

            <div className="linha-fixa-benefits" aria-label="Benefícios da Linha Fixa Acessanet">
              {featuredBenefits.map((benefit) => (
                <span key={benefit} className="linha-fixa-benefit">
                  {renderBenefitIcon(benefit)} {benefit}
                </span>
              ))}
            </div>
          </div>

          <figure className="linha-fixa-visual">
            <span className="linha-fixa-light-trails" aria-hidden="true" />
            <img
              src={telefoneFixoImage}
              alt="Telefone fixo Acessanet"
              width="1024"
              height="1024"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>

        <div className="linha-fixa-info-bar accordion-container" aria-label="Informações da Linha Fixa Acessanet">
          <div className={`linha-fixa-info-item accordion-item ${activeItem === "portabilidade" ? "linha-fixa-info-item--open open" : ""}`}>
            <button
              type="button"
              className="linha-fixa-info-control accordion-trigger"
              aria-expanded={activeItem === "portabilidade"}
              aria-controls="linha-fixa-info-portabilidade"
              onClick={() => toggleItem("portabilidade")}
            >
              <span className="linha-fixa-info-icon">
                <FaExchangeAlt />
              </span>
              <strong>Portabilidade</strong>
              <FaChevronDown className="linha-fixa-chevron" />
            </button>
            {activeItem === "portabilidade" && (
              <div id="linha-fixa-info-portabilidade" className="linha-fixa-info-panel accordion-content">
                <p>Consulte a possibilidade de trazer seu número atual para a Linha Fixa Acessanet.</p>
                <a
                  href={getFixedLineWhatsappUrl(whatsappMessages.portability)}
                  target="_blank"
                  rel="noreferrer"
                  className="linha-fixa-inline-action"
                >
                  Consultar portabilidade
                </a>
              </div>
            )}
          </div>

          <div className={`linha-fixa-info-item accordion-item ${activeItem === "condicoes" ? "linha-fixa-info-item--open open" : ""}`}>
            <button
              type="button"
              className="linha-fixa-info-control accordion-trigger"
              aria-expanded={activeItem === "condicoes"}
              aria-controls="linha-fixa-info-condicoes"
              onClick={() => toggleItem("condicoes")}
            >
              <span className="linha-fixa-info-icon">
                <FaInfoCircle />
              </span>
              <strong>Condições</strong>
              <FaChevronDown className="linha-fixa-chevron" />
            </button>
            {activeItem === "condicoes" && (
              <div id="linha-fixa-info-condicoes" className="linha-fixa-info-panel accordion-content">
                <p>{fixedLinePlan.secondaryDescription}</p>
                <button
                  type="button"
                  className="linha-fixa-inline-action linha-fixa-inline-action--button"
                  onClick={() => setIsConditionsOpen(true)}
                >
                  Ver condições completas
                </button>
                {isPlanosPage && (
                  <ul className="linha-fixa-mini-faq">
                    {fixedLineFaqs.slice(0, 3).map((faq) => (
                      <li key={faq.question}>{faq.question}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isConditionsOpen && (
        <div
          className="linha-fixa-modal-backdrop"
          role="presentation"
          onClick={() => setIsConditionsOpen(false)}
        >
          <div
            className="linha-fixa-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="linha-fixa-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="linha-fixa-modal-close"
              aria-label="Fechar condições"
              onClick={() => setIsConditionsOpen(false)}
            >
              <FaTimes />
            </button>

            <span className="linha-fixa-modal-tag">Condições</span>
            <h2 id="linha-fixa-modal-title">Condições da Linha Fixa Acessanet</h2>

            <ul>
              {conditions.map((condition) => (
                <li key={condition}>
                  <FaCheckCircle /> {condition}
                </li>
              ))}
            </ul>

            <p className="linha-fixa-modal-note">
              Para confirmar contratação, instalação, portabilidade e demais condições, fale com a equipe da Acessanet.
            </p>

            <a
              href={getFixedLineWhatsappUrl(whatsappMessages.conditions)}
              target="_blank"
              rel="noreferrer"
              className="linha-fixa-btn linha-fixa-btn--primary"
            >
              <FaWhatsapp /> Falar com atendimento
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
