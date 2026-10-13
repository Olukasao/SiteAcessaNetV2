import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { whatsappLink } from "../data/site";

// Aparece só depois do hero, pra não competir com os CTAs principais.
export default function WhatsAppFloat() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      className={`wa-float ${show ? "is-in" : ""}`}
      href={whatsappLink("Olá! Gostaria de saber mais sobre os planos da AcessaNet.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com a AcessaNet pelo WhatsApp"
      tabIndex={show ? 0 : -1}
    >
      <FaWhatsapp size={26} aria-hidden="true" />
      <span>Fale com a gente</span>
      <style>{`
        .wa-float {
          position: fixed; right: 20px; bottom: max(20px, env(safe-area-inset-bottom)); z-index: 40;
          display: inline-flex; align-items: center; gap: 10px; height: 56px; padding: 0 18px;
          border-radius: 999px; color: #04351f; background: #25d366; font-weight: 800; font-size: .95rem;
          box-shadow: 0 18px 40px -14px rgba(37, 211, 102, .8);
          opacity: 0; transform: translateY(20px) scale(.96); pointer-events: none;
          transition: opacity .4s var(--ease-out), transform .5s var(--ease-spring), box-shadow .3s;
        }
        .wa-float.is-in { opacity: 1; transform: none; pointer-events: auto; }
        .wa-float:hover { box-shadow: 0 22px 50px -12px rgba(37, 211, 102, 1); }
        @media (max-width: 640px) { .wa-float span { display: none; } .wa-float { width: 56px; padding: 0; justify-content: center; } }
      `}</style>
    </a>
  );
}
