import {
  ArrowDown,
  House,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../../assets/logo acessa (2).png";
import { SharedConnectionIllustration } from "./SharedConnectionIllustration";

const navItems = [
  { label: "Roteador", id: "roteador" },
  { label: "Wi-Fi", id: "wifi" },
  { label: "Velocidade", id: "velocidade" },
  { label: "Teste", id: "teste" },
  { label: "Cobertura", id: "cobertura" },
  { label: "Suporte", id: "suporte" },
];

function scrollToId(id) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  if (window.lenis) {
    window.lenis.scrollTo(element, { offset: -84 });
  } else {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#${id}`
  );
}

function handleNavClick(id) {
  return (event) => {
    event.preventDefault();
    scrollToId(id);
  };
}

export function GuideHeader({ supportUrl, onSupportClick }) {
  return (
    <header className="guide-header" id="topo">
      <div className="guide-shell guide-header-inner">
        <Link
          to="/"
          className="guide-logo-link"
          aria-label="Voltar para a página inicial da AcessaNet"
        >
          <img src={logo} alt="AcessaNet" className="guide-logo" />
        </Link>

        <div className="guide-header-actions">
          <Link className="guide-home-link" to="/">
            <House aria-hidden="true" size={18} />
            <span>Início</span>
          </Link>

          <a
            className="guide-support-link"
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSupportClick("header")}
          >
            <PhoneCall aria-hidden="true" size={18} />
            <span>Falar com o suporte</span>
          </a>
        </div>
      </div>
    </header>
  );
}

export function GuideHero() {
  return (
    <section className="guide-hero" aria-labelledby="guide-hero-title">
      <div className="guide-hero-grid guide-shell">
        <div className="guide-hero-copy">
          <span className="guide-eyebrow">
            <ShieldCheck aria-hidden="true" size={16} />
            Guia oficial AcessaNet
          </span>

          <h1 id="guide-hero-title">SUA INTERNET PODE FUNCIONAR AINDA MELHOR</h1>

          <p className="guide-hero-lead">
            Pequenos cuidados com o roteador e o Wi-Fi podem fazer uma grande
            diferença na qualidade da sua conexão.
          </p>

          <p className="guide-hero-note">
            Preparamos algumas dicas simples para você aproveitar melhor sua
            internet no dia a dia.
          </p>

          <button
            className="guide-primary-button"
            type="button"
            onClick={() => scrollToId("dicas")}
          >
            Ver todas as dicas
            <ArrowDown aria-hidden="true" size={18} />
          </button>
        </div>

        <div
          className="guide-hero-visual"
          aria-label="Ilustração de dispositivos usando a mesma conexão com roteador central"
        >
          <SharedConnectionIllustration />
        </div>
      </div>
    </section>
  );
}

export function GuideNav() {
  return (
    <nav className="guide-nav" aria-label="Navegação do guia">
      <div className="guide-shell guide-nav-scroll">
        {navItems.map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={handleNavClick(item.id)}>
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
