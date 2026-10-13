import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, MapPin, Pause, Play, ShieldCheck } from "lucide-react";
import Globe from "../components/Globe";
import { useUI } from "../context/UIContext";
import { company, coveredCitiesLabel, plans, services } from "../data/site";
import { gsap } from "../hooks/useReveal";
import { prefersReducedMotion } from "../hooks/useDeviceTier";
import "./hero.css";

// Rotação do hero: mensagem da marca -> planos -> marca... O globo fica
// fixo; só a área de texto troca. Tempos em ms.
const SLIDES = [
  { id: "brand", label: "Início", duration: 4000 },
  ...plans.map((p) => ({ id: p.id, label: p.short, duration: 4500, plan: p })),
];
const INTRO_MS = 1000; // a contagem só começa depois da entrada inicial

export default function Hero() {
  const ref = useRef(null);
  const { openCoverage, openPlan } = useUI();
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPause, setHoverPause] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const progressRef = useRef(0);
  const barRefs = useRef([]);

  const activeRef = useRef(0);
  const goTo = useCallback((i) => {
    const cur = activeRef.current;
    progressRef.current = 0;
    if (cur === i) return;
    activeRef.current = i;
    setPrev(cur);
    setActive(i);
  }, []);

  // Entrada inicial (só no primeiro slide). Durante ela as transições CSS
  // dos slides ficam desligadas (.is-intro) pra não brigar com o GSAP.
  useLayoutEffect(() => {
    if (reduced) return undefined;
    const root = ref.current;
    root.classList.add("is-intro");
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "expo.out", clearProps: "transform,opacity" },
        onComplete: () => root.classList.remove("is-intro"),
      });
      const b = ".hs-slide--brand";
      tl.from(`${b} .hero-eyebrow`, { y: 16, opacity: 0, duration: 0.8 })
        .from(`${b} .hero-line > span`, { yPercent: 110, duration: 1.1, stagger: 0.12 }, "-=0.55")
        .from(`${b} .hero-sub`, { y: 18, opacity: 0, duration: 0.9 }, "-=0.75")
        .from(`${b} .hero-ctas > *`, { y: 16, opacity: 0, duration: 0.8, stagger: 0.08 }, "-=0.7")
        .from(".hero-rotator, .hero-trust li", { y: 10, opacity: 0, duration: 0.7, stagger: 0.05 }, "-=0.6")
        .from(".hero-visual-inner > .globe", { opacity: 0, scale: 0.94, duration: 1.8, ease: "power3.out" }, 0);

      gsap.to(".hero-visual-inner", {
        yPercent: 12,
        opacity: 0.35,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-copy", {
        yPercent: -10,
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: root, start: "40% top", end: "bottom top", scrub: true },
      });
    }, ref);
    return () => {
      root.classList.remove("is-intro");
      ctx.revert();
    };
  }, [reduced]);

  // Pausa quando o hero sai da tela
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.25 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  // Relógio da rotação: acumula tempo só enquanto não está pausado e
  // escreve o progresso direto no DOM (sem re-render a cada frame).
  const paused = reduced || userPaused || hoverPause || offscreen;
  useEffect(() => {
    if (paused) return undefined;
    let raf;
    let last = performance.now();
    const startAt = last + (progressRef.current === 0 && active === 0 && prev === null ? INTRO_MS : 0);
    const loop = (now) => {
      if (now >= startAt) progressRef.current += now - Math.max(last, startAt);
      last = now;
      const dur = SLIDES[active].duration;
      const p = Math.min(progressRef.current / dur, 1);
      barRefs.current[active]?.style.setProperty("--p", p);
      if (p >= 1) {
        goTo((active + 1) % SLIDES.length);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, active, prev, goTo]);

  useEffect(() => {
    barRefs.current.forEach((el, i) => i !== active && el?.style.setProperty("--p", 0));
  }, [active]);

  const stateOf = (i) => (i === active ? "active" : i === prev ? "leaving" : "idle");

  return (
    <section
      ref={ref}
      className="hero"
      aria-labelledby="hero-title"
      aria-roledescription="carrossel"
    >
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-aurora" />
        <div className="hero-stars" />
      </div>

      <div className="hero-visual">
        <div className="hero-visual-inner">
          <Globe />
        </div>
      </div>

      <div
        className="hero-copy container"
        onPointerEnter={(e) => e.pointerType === "mouse" && setHoverPause(true)}
        onPointerLeave={() => setHoverPause(false)}
        onFocus={() => setHoverPause(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHoverPause(false)}
      >
        <div className="hs-stage">
          {SLIDES.map((s, i) => {
            const state = stateOf(i);
            const hidden = state !== "active";
            const common = {
              "data-state": state,
              "aria-hidden": hidden || undefined,
              inert: hidden || undefined,
              role: "group",
              "aria-roledescription": "slide",
              "aria-label": `${i + 1} de ${SLIDES.length}: ${s.id === "brand" ? "AcessaNet" : s.plan.name}`,
            };
            if (s.id === "brand") {
              return (
                <div key={s.id} className="hs-slide hs-slide--brand" {...common}>
                  <p className="hero-eyebrow hs-item" style={{ "--i": 0 }}>
                    <span className="hero-dot" aria-hidden="true" /> Internet 100% fibra óptica
                  </p>
                  <h1 id="hero-title" className="hero-title">
                    <span className="hero-line" style={{ "--i": 1 }}><span>Cada mundo.</span></span>
                    <span className="hero-line hero-line--accent" style={{ "--i": 2 }}><span>Uma conexão.</span></span>
                  </h1>
                  <p className="hero-sub hs-item" style={{ "--i": 3 }}>Conectando você a tudo que importa.</p>
                  <div className="hero-ctas hs-item" style={{ "--i": 4 }}>
                    <Link to="/planos" className="btn btn--primary">
                      Conhecer planos <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                    <button type="button" className="btn btn--ghost-dark" onClick={() => openCoverage()}>
                      <MapPin size={18} aria-hidden="true" /> Consultar cobertura
                    </button>
                  </div>
                </div>
              );
            }
            const p = s.plan;
            const shown = p.includes.slice(0, 4);
            const more = p.includes.length - shown.length;
            return (
              <div key={s.id} className={`hs-slide hs-slide--plan ${p.featured ? "is-featured" : ""}`} {...common}>
                <p className="hero-eyebrow hs-item" style={{ "--i": 0 }}>
                  <span className="hero-dot" aria-hidden="true" />
                  {p.featured ? p.badge : "Plano residencial"} · {p.variant ? p.variant.replace(/^com /, "Com ") : "Fibra óptica"}
                </p>
                <h2 className="hero-title hs-plan-title">
                  <span className="hero-line" style={{ "--i": 1 }}>
                    <span>{p.speed}</span>
                  </span>
                  <span className="hero-line hero-line--accent hs-plan-unit" style={{ "--i": 2 }}>
                    <span>{p.unit}</span>
                  </span>
                </h2>
                <p className="hero-sub hs-item" style={{ "--i": 3 }}>{p.tagline}</p>
                <ul className="hs-chips hs-item" style={{ "--i": 4 }} aria-label="Incluso no plano">
                  {shown.map((k) => (
                    <li key={k}>{services[k].name}</li>
                  ))}
                  {more > 0 && <li className="is-more">+{more}</li>}
                </ul>
                <div className="hs-buy hs-item" style={{ "--i": 5 }}>
                  <p className="hs-price" aria-label={`${p.priceText} por mês`}>
                    <span className="hs-cur">R$</span>
                    <strong>{p.price.int}</strong>
                    <span className="hs-cents">,{p.price.cents}<small>/mês</small></span>
                  </p>
                  <div className="hero-ctas">
                    <button type="button" className="btn btn--primary" onClick={() => openPlan(p.id)}>
                      Quero este plano <ArrowRight size={18} aria-hidden="true" />
                    </button>
                    <Link to="/planos" className="btn btn--ghost-dark">Ver todos</Link>
                  </div>
                </div>
                <p className="hs-note hs-item" style={{ "--i": 6 }}>{p.note}</p>
              </div>
            );
          })}
        </div>

        <div
          className="hero-rotator"
          role="group"
          aria-label="Destaques do topo"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") goTo((active + 1) % SLIDES.length);
            if (e.key === "ArrowLeft") goTo((active - 1 + SLIDES.length) % SLIDES.length);
          }}
        >
          <div className="hr-arrows">
            <button type="button" className="hr-arrow" aria-label="Destaque anterior" onClick={() => goTo((active - 1 + SLIDES.length) % SLIDES.length)}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="hr-arrow" aria-label="Próximo destaque" onClick={() => goTo((active + 1) % SLIDES.length)}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`hr-dot ${i === active ? "is-active" : ""}`}
              aria-current={i === active ? "true" : undefined}
              aria-label={`Mostrar ${s.id === "brand" ? "mensagem inicial" : s.plan.name}`}
              onClick={() => goTo(i)}
            >
              <span className="hr-label">{s.label}</span>
              <span className="hr-bar" ref={(el) => (barRefs.current[i] = el)} />
            </button>
          ))}
          {!reduced && (
            <button
              type="button"
              className="hr-toggle"
              onClick={() => setUserPaused((v) => !v)}
              aria-label={userPaused ? "Retomar rotação automática" : "Pausar rotação automática"}
            >
              {userPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            </button>
          )}
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
