import { createElement } from "react";
import {
  ArrowRight,
  CalendarDays,
  Headphones,
  Ribbon,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Wifi,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import heroFamily from "../../assets/banner inicio.png";
import heroOutubroRosa from "../../assets/banners/outubrorosa-sem-temsaude@2x.webp";
import { seasonalCampaign } from "../../theme/siteTheme";
import AwarenessCard from "./AwarenessCard";
import TemSaudeCard from "./TemSaudeCard";
import "./awarenessCardsLayout.css";

const isOutubroRosa =
  seasonalCampaign.enabled && seasonalCampaign.theme === "outubro-rosa";
const heroImage = isOutubroRosa ? heroOutubroRosa : heroFamily;

// Cards de conscientização (Autoexame/Mamografia/Consulta/TemSaúde) tirados
// do banner por enquanto. Pra reativar, troque para `true`.
const SHOW_AWARENESS_CARDS = false;

// Cards flutuantes (Ultra velocidade/100% Fibra/Suporte rápido) tirados do
// banner por enquanto. Pra reativar, troque para `true`.
const SHOW_FLOATING_HIGHLIGHTS = false;

const floatingHighlights = [
  {
    icon: Zap,
    title: "Ultra velocidade",
    text: "para streaming e jogos",
    className: "hero-float-card speed",
  },
  {
    icon: Wifi,
    title: "100% Fibra Óptica",
    text: "mais estabilidade",
    className: "hero-float-card fiber",
  },
  {
    icon: Headphones,
    title: "Suporte rápido",
    text: "atendimento próximo",
    className: "hero-float-card support",
  },
];

const awarenessCards = [
  {
    icon: CalendarDays,
    title: "Autoexame mensal",
    text: "Conheça seu corpo. Pequenas atitudes fazem grande diferença.",
    className: "awareness-card-autoexame",
  },
  {
    icon: Ribbon,
    title: "Mamografia em dia",
    text: "A detecção precoce aumenta as chances de cura.",
    className: "awareness-card-mamografia",
  },
  {
    icon: Stethoscope,
    title: "Consulta preventiva",
    text: "Converse com um profissional de saúde e tire suas dúvidas.",
    className: "awareness-card-consulta",
  },
  {
    icon: Smartphone,
    title: "Aproveite nossos planos com o aplicativo de telemedicina TemSaúde.",
    highlight: "TemSaúde",
    text: "Mais cuidado, praticidade e bem-estar para você e sua família.",
    className: "awareness-card-temsaude",
    large: true,
  },
];

export default function HeroSection() {
  return (
    <section
      id="inicio"
      className={`landing-hero${isOutubroRosa ? " landing-hero--poster" : ""}`}
    >
      {isOutubroRosa ? (
        // Poster da campanha (arte pronta, com texto embutido): fica numa caixa
        // própria com a MESMA proporção da imagem (1774:887), pra nunca cortar
        // nada por engano. TemSaudeCard mora aqui dentro porque sua posição é
        // calculada em % relativa a essa caixa (ver temSaudeCard.css).
        <div className="hero-poster-media">
          <img
            src={heroImage}
            alt="Outubro Rosa: internet que conecta, cuidado que aproxima. Campanha de conscientização e prevenção do câncer de mama."
            className="hero-background-image"
            width="1774"
            height="887"
            fetchPriority="high"
            decoding="async"
          />
          <TemSaudeCard />
        </div>
      ) : (
        <img
          src={heroImage}
          alt="Família usando internet fibra óptica em casa"
          className="hero-background-image"
          width="1672"
          height="941"
          fetchPriority="high"
          decoding="async"
        />
      )}

      {!isOutubroRosa && (
        <div className="hero-background-overlay" aria-hidden="true" />
      )}
      {!isOutubroRosa && (
        <>
          <div className="hero-fiber-lines" aria-hidden="true" />
          <div className="hero-connection-panel" aria-hidden="true" />
        </>
      )}

      {!isOutubroRosa && (
        <div className="landing-hero-inner">
          <div className="hero-copy-card">
            <span className="hero-eyebrow">BEM-VINDO À ACESSANET</span>

            <h1>
              A internet <strong>fibra óptica</strong> ideal para sua casa
            </h1>

            <p>
              Mais velocidade, estabilidade e suporte de qualidade para você
              navegar, assistir, jogar e trabalhar sem preocupações.
            </p>

            <div className="hero-actions">
              <Link to="/planos" className="hero-primary">
                Conheça os planos
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="hero-trust">
              <ShieldCheck size={18} />
              <span>Conexão confiável para todos os momentos da sua casa</span>
            </div>
          </div>
        </div>
      )}

      {/*
        A arte do pôster não tem nenhum CTA clicável de verdade (é só pixels) --
        essa faixa abaixo dela garante um "Conheça os planos" real, acessível e
        clicável em qualquer tela, inclusive quando a imagem é recortada no
        mobile (ver .hero-poster-media no landing.css) e o texto desenhado nela
        fica pequeno demais pra ler.
      */}
      {isOutubroRosa && (
        <div className="hero-poster-cta">
          <span className="hero-campaign-badge">
            <Ribbon size={13} aria-hidden="true" />
            Outubro Rosa 2026
          </span>

          <p className="hero-poster-cta-text">
            Internet que conecta, cuidado que aproxima. Conheça os planos com
            benefício TemSaúde.
          </p>

          <Link to="/planos" className="hero-primary">
            Conheça os planos
            <ArrowRight size={18} />
          </Link>
        </div>
      )}

      {SHOW_FLOATING_HIGHLIGHTS &&
        (!isOutubroRosa || !SHOW_AWARENESS_CARDS) &&
        floatingHighlights.map(({ icon, title, text, className }) => (
          <div className={className} key={title}>
            <span>
              {createElement(icon, { size: 18 })}
            </span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          </div>
        ))}

      {isOutubroRosa && SHOW_AWARENESS_CARDS && (
        <div className="hero-awareness-cards">
          <svg
            className="hero-awareness-lines"
            viewBox="0 0 520 460"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 90,70 C 180,40 280,40 400,90"
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.5"
            />
            <path
              d="M 400,110 C 420,190 420,230 380,280"
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.5"
            />
            <path
              d="M 320,330 C 300,360 280,380 260,400"
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.5"
            />
          </svg>

          {awarenessCards.map(
            ({ icon, title, highlight, text, className, large }) => (
              <AwarenessCard
                key={title}
                icon={icon}
                title={title}
                highlight={highlight}
                text={text}
                className={className}
                large={large}
              />
            )
          )}
        </div>
      )}

      {isOutubroRosa && <TemSaudeCard />}
    </section>
  );
}
