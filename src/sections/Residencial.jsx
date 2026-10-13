import { useLayoutEffect, useRef } from "react";
import { HeartHandshake, MonitorPlay, Router, Zap } from "lucide-react";
import { gsap, useReveal } from "../hooks/useReveal";
import { prefersReducedMotion } from "../hooks/useDeviceTier";
import "./residencial.css";

// Textos de BenefitsSection.jsx (produção).
const steps = [
  { icon: Zap, title: "Navegação rápida", text: "Planos pensados para manter sua rotina digital sempre fluida." },
  { icon: MonitorPlay, title: "Streaming sem travamentos", text: "Mais estabilidade para filmes, séries, lives e conteúdos em alta definição." },
  { icon: Router, title: "Wi-Fi para toda a casa", text: "Conexão preparada para celulares, notebooks, TVs e dispositivos inteligentes." },
  { icon: HeartHandshake, title: "Suporte humanizado", text: "Atendimento próximo, ágil e focado em resolver o que você precisa." },
];

export default function Residencial() {
  const ref = useRef(null);
  useReveal(ref);

  // Sequência de scroll: a "fibra" desce acompanhando a rolagem (scrub) e
  // cada etapa acende quando a luz chega nela.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      ref.current?.querySelectorAll(".res-step").forEach((el) => el.classList.add("is-lit"));
      return undefined;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".res-fiber-fill",
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: { trigger: ".res-steps", start: "top 70%", end: "bottom 60%", scrub: 0.6 },
        }
      );
      gsap.utils.toArray(".res-step").forEach((el) => {
        gsap.timeline({
          scrollTrigger: { trigger: el, start: "top 66%", toggleClass: { targets: el, className: "is-lit" }, once: false },
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="beneficios" className="section res" aria-labelledby="res-title">
      <div className="container res-grid">
        <div className="res-intro">
          <div className="res-sticky" data-reveal>
            <span className="eyebrow">Internet residencial</span>
            <h2 id="res-title">A fibra chega inteira até a sua casa.</h2>
            <p>
              Tecnologia, estabilidade e atendimento local em uma experiência de internet feita para residências conectadas.
            </p>
          </div>
        </div>

        <div className="res-steps">
          <span className="res-fiber" aria-hidden="true">
            <span className="res-fiber-fill" />
          </span>
          <ol className="res-list">
          {steps.map(({ icon: Icon, title, text }) => (
            <li key={title} className="res-step">
              <span className="res-node" aria-hidden="true">
                <Icon size={22} />
              </span>
              <div className="res-card">
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
