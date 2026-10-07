import { useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isFinePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;

    if (prefersReducedMotion || !isFinePointer) {
      window.lenis = null;
      return undefined;
    }

    const lenis = new Lenis({
      duration: 0.85,
      smoothWheel: true,
      syncTouch: false,
    });

    window.lenis = lenis;
    let frameId;

    function raf(time) {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    }

    frameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
      if (window.lenis === lenis) {
        window.lenis = null;
      }
    };
  }, []);

  return null;
}
