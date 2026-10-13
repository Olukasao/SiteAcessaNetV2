import { useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "./useDeviceTier";

gsap.registerPlugin(ScrollTrigger);

// Entradas em lote com ScrollTrigger.batch: elementos com [data-reveal]
// dentro do escopo sobem 28px + fade, em cascata de 80ms, uma única vez.
// Segurança: se por qualquer motivo o trigger não disparar (aba em segundo
// plano, print, captura full-page), tudo é revelado em 2.5s -- conteúdo
// nunca fica invisível (bug observado no site atual).
export function useReveal(scopeRef) {
  useLayoutEffect(() => {
    if (prefersReducedMotion() || !scopeRef.current) return undefined;
    document.documentElement.classList.add("js-motion");
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray("[data-reveal]", scopeRef.current);
      ScrollTrigger.batch(items, {
        start: "top 90%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "expo.out",
            stagger: 0.08,
            overwrite: true,
          }),
      });
    }, scopeRef);
    const safety = setTimeout(() => {
      gsap.utils.toArray("[data-reveal]", scopeRef.current).forEach((el) => {
        if (getComputedStyle(el).opacity === "0" && el.getBoundingClientRect().top < window.innerHeight) {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.6 });
        }
      });
    }, 2500);
    const onPrint = () => gsap.set("[data-reveal]", { opacity: 1, y: 0 });
    window.addEventListener("beforeprint", onPrint);
    return () => {
      clearTimeout(safety);
      window.removeEventListener("beforeprint", onPrint);
      ctx.revert();
    };
  }, [scopeRef]);
}

export { gsap, ScrollTrigger };
