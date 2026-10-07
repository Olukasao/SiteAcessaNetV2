import { useState } from "react";
import { ArrowDown, ChevronDown, House, PhoneCall, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../../assets/logo acessa (2).png";

const faqItems = [
  {
    question: "Aumentar meu plano aumenta o alcance do Wi-Fi?",
    answer:
      "Não. Aumentar o plano aumenta a capacidade e a velocidade disponível, mas não aumenta automaticamente a distância do sinal Wi-Fi.",
  },
  {
    question: "Posso apertar RESET quando a internet parar?",
    answer:
      "Não. O RESET pode apagar as configurações do roteador. Para reiniciar, desligue o equipamento da energia, aguarde alguns segundos e ligue novamente.",
  },
  {
    question: "5 GHz é sempre melhor?",
    answer:
      "Não. O 5 GHz geralmente oferece maior velocidade, mas possui menor alcance. O 2,4 GHz normalmente consegue atingir distâncias maiores.",
  },
  {
    question: "Um repetidor resolve qualquer problema?",
    answer:
      "Não. Para funcionar corretamente, ele precisa receber um bom sinal do roteador principal.",
  },
  {
    question: "Por que meu celular não atinge toda a velocidade?",
    answer:
      "A velocidade também depende da tecnologia Wi-Fi do aparelho, distância, frequência utilizada e capacidade do próprio dispositivo.",
  },
];

function scrollToTop() {
  const element = document.getElementById("topo");

  if (window.lenis) {
    window.lenis.scrollTo(element || 0);
  } else if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#topo`
  );
}

export function GuideFAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="guide-section faq-section" aria-labelledby="faq-title">
      <div className="guide-shell">
        <div className="guide-section-heading">
          <span>Dúvidas frequentes</span>
          <h2 id="faq-title">PERGUNTAS FREQUENTES</h2>
        </div>

        <div className="faq-list">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            const buttonId = `faq-button-${index}`;
            const panelId = `faq-panel-${index}`;

            return (
              <div className={`faq-item ${isOpen ? "open" : ""}`} key={item.question}>
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  >
                    <span>{item.question}</span>
                    <ChevronDown aria-hidden="true" size={22} />
                  </button>
                </h3>
                <div
                  id={panelId}
                  className="faq-panel"
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                >
                  <p>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SupportCTA({ supportUrl, onSupportClick }) {
  return (
    <section className="guide-final-cta" aria-labelledby="support-cta-title">
      <div className="guide-shell final-cta-inner">
        <div>
          <span className="guide-mini-label">Suporte AcessaNet</span>
          <h2 id="support-cta-title">AINDA PRECISA DE AJUDA?</h2>
          <p>
            Nossa equipe está pronta para ajudar você a identificar o que está
            acontecendo com sua conexão.
          </p>
        </div>

        <div className="final-cta-actions">
          <a
            className="guide-primary-button support"
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSupportClick("final_cta")}
          >
            <PhoneCall aria-hidden="true" size={20} />
            FALAR COM O SUPORTE
          </a>

          <button className="guide-secondary-button" type="button" onClick={scrollToTop}>
            <ArrowDown aria-hidden="true" size={18} />
            Voltar ao início
          </button>
        </div>
      </div>
    </section>
  );
}

export function GuideFooter({ supportUrl, onSupportClick }) {
  return (
    <footer className="guide-footer">
      <div className="guide-shell guide-footer-inner">
        <div>
          <img src={logo} alt="AcessaNet" className="guide-footer-logo" />
          <p>ACESSANET TELECON LTDA</p>
        </div>

        <div className="guide-footer-support">
          <Wifi aria-hidden="true" size={18} />
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSupportClick("footer")}
          >
            Suporte oficial
          </a>
        </div>

        <Link className="guide-footer-home" to="/">
          <House aria-hidden="true" size={18} />
          Voltar para a home
        </Link>

        <span>© {new Date().getFullYear()} AcessaNet - Todos os direitos reservados</span>
      </div>
    </footer>
  );
}
