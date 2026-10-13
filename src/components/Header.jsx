import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, UserRound, X } from "lucide-react";
import logo from "../assets/logo-acessanet.png";
import { company, wifiGuideUrl } from "../data/site";
import { useUI } from "../context/UIContext";
import "./header.css";

// Barra do desktop: o essencial. Benefícios/Atendimento (âncoras da home)
// ficam no menu móvel e no rodapé pra não lotar a barra.
const links = [
  { to: "/planos", label: "Planos" },
  { to: "/empresas", label: "Empresas" },
  { href: wifiGuideUrl, label: "Boas práticas Wi-Fi" },
  { to: "/contratos", label: "Contratos e Termos" },
];
const mobileExtra = [
  { to: "/#beneficios", label: "Benefícios" },
  { to: "/#atendimento", label: "Atendimento" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const { openCoverage } = useUI();
  const { pathname, hash } = useLocation();

  useEffect(() => setOpen(false), [pathname, hash]);

  // Header "inteligente": vidro depois de rolar, esconde ao descer e volta ao subir.
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        setHidden(y > 480 && y > last + 4);
        if (y < last - 4) setHidden(false);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`hdr ${scrolled ? "is-scrolled" : ""} ${hidden && !open ? "is-hidden" : ""}`}>
      <div className="hdr-inner container">
        <Link to="/" className="hdr-logo" aria-label="AcessaNet — página inicial">
          <img src={logo} alt="AcessaNet" width="560" height="315" />
        </Link>

        <nav className="hdr-nav" aria-label="Principal">
          {links.map((l) =>
            l.href ? (
              <a key={l.href} href={l.href} className="hdr-link">
                {l.label}
              </a>
            ) : l.to.includes("#") ? (
              <Link key={l.to} to={l.to} className="hdr-link">
                {l.label}
              </Link>
            ) : (
              <NavLink key={l.to} to={l.to} className="hdr-link">
                {l.label}
              </NavLink>
            )
          )}
          <button type="button" className="hdr-link" onClick={() => openCoverage()}>
            Cobertura
          </button>
        </nav>

        <div className="hdr-actions">
          <a className="hdr-central" href={company.centralUrl}>
            <UserRound size={18} aria-hidden="true" /> Central do Assinante
          </a>
          <Link className="btn btn--primary btn--sm hdr-cta" to="/planos">
            Assine já
          </Link>
          <button
            type="button"
            className="hdr-burger"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="hdr-mobile"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
          >
            <nav aria-label="Menu móvel" className="hdr-mobile-nav">
              {[...links, ...mobileExtra].map((l, i) => (
                <motion.div key={l.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.04 * i + 0.08 } }}>
                  {l.href ? <a href={l.href}>{l.label}</a> : <Link to={l.to}>{l.label}</Link>}
                </motion.div>
              ))}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.36 } }}>
                <button type="button" onClick={() => { setOpen(false); openCoverage(); }}>Consultar cobertura</button>
              </motion.div>
            </nav>
            <div className="hdr-mobile-actions">
              <Link className="btn btn--primary btn--block" to="/planos">Conhecer planos</Link>
              <a className="btn btn--ghost-dark btn--block" href={company.centralUrl}>
                <UserRound size={18} aria-hidden="true" /> Central do Assinante
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
