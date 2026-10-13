import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, MapPin, ShieldCheck } from "lucide-react";
import Globe from "../components/Globe";
import { useUI } from "../context/UIContext";
import { company, coveredCitiesLabel } from "../data/site";
import { gsap } from "../hooks/useReveal";
import { prefersReducedMotion } from "../hooks/useDeviceTier";
import "./hero.css";

export default function Hero() {
  const ref = useRef(null);
  const { openCoverage } = useUI();

  // Sequência de entrada: linhas do título sobem por trás de uma máscara,
  // depois subtítulo, CTAs e selos. Total ~1.6s; o texto é legível desde
  // ~0.5s. Sem reduced-motion = tudo estático desde o primeiro paint.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-eyebrow", { y: 16, opacity: 0, duration: 0.8 })
        .from(".hero-line > span", { yPercent: 110, duration: 1.1, stagger: 0.12 }, "-=0.55")
        .from(".hero-sub", { y: 18, opacity: 0, duration: 0.9 }, "-=0.75")
        .from(".hero-ctas > *", { y: 16, opacity: 0, duration: 0.8, stagger: 0.08 }, "-=0.7")
        .from(".hero-trust li", { y: 10, opacity: 0, duration: 0.7, stagger: 0.06 }, "-=0.6")
        .from(".hero-visual-inner > .globe", { opacity: 0, scale: 0.94, duration: 1.8, ease: "power3.out" }, 0);

      // Saída sutil ao rolar: o globo afunda e o texto sobe levemente.
      gsap.to(".hero-visual-inner", {
        yPercent: 12,
        opacity: 0.35,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-copy", {
        yPercent: -10,
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "40% top", end: "bottom top", scrub: true },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="hero" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-aurora" />
        <div className="hero-stars" />
      </div>

      <div className="hero-visual">
        <div className="hero-visual-inner">
          <Globe />
        </div>
      </div>

      <div className="hero-copy container">
        <p className="hero-eyebrow">
          <span className="hero-dot" aria-hidden="true" /> Internet 100% fibra óptica
        </p>
        <h1 id="hero-title" className="hero-title">
          <span className="hero-line"><span>Cada mundo.</span></span>
          <span className="hero-line hero-line--accent"><span>Uma conexão.</span></span>
        </h1>
        <p className="hero-sub">Conectando você a tudo que importa.</p>

        <div className="hero-ctas">
          <Link to="/planos" className="btn btn--primary">
            Conhecer planos <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <button type="button" className="btn btn--ghost-dark" onClick={() => openCoverage()}>
            <MapPin size={18} aria-hidden="true" /> Consultar cobertura
          </button>
        </div>

        <ul className="hero-trust" aria-label="Diferenciais">
          <li><Clock3 size={16} aria-hidden="true" /> Suporte {company.supportHours.toLowerCase()}</li>
          <li><ShieldCheck size={16} aria-hidden="true" /> Desde {company.since}</li>
          <li><MapPin size={16} aria-hidden="true" /> {coveredCitiesLabel}</li>
        </ul>
      </div>

      <div className="hero-scroll" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}
