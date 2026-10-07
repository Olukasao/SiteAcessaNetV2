import { useEffect, useRef } from "react";
import "../styles/components-styles/cursor.css";

const interactiveSelector = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "label",
  "[role='button']",
  ".plano-card",
  ".movie-card",
  ".channel-card",
].join(", ");

export default function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const canUseCustomCursor = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
    ).matches;

    if (!cursor || !canUseCustomCursor) {
      return undefined;
    }

    let frameId = 0;
    let x = -100;
    let y = -100;
    let cachedScale = 1;
    let lastScaleCheck = 0;

    const applyPosition = () => {
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      frameId = 0;
    };

    const getScaleFactor = () => {
      // Cachear por 500ms para não recalcular a cada movimento
      const now = Date.now();
      if (now - lastScaleCheck < 500) {
        return cachedScale;
      }
      
      lastScaleCheck = now;
      
      // Criar um elemento de teste com tamanho conhecido
      const testElement = document.createElement('div');
      testElement.style.width = '100px';
      testElement.style.height = '100px';
      testElement.style.position = 'absolute';
      testElement.style.visibility = 'hidden';
      document.body.appendChild(testElement);
      
      const rect = testElement.getBoundingClientRect();
      document.body.removeChild(testElement);
      
      // Se o elemento tem 100px de CSS mas getBoundingClientRect retorna menos,
      // é porque há zoom/scale
      cachedScale = rect.width / 100;
      return cachedScale;
    };

    const moveCursor = (event) => {
      const scale = getScaleFactor();
      
      x = event.clientX / scale;
      y = event.clientY / scale;

      cursor.classList.add("cursor-visible");
      const target = event.target instanceof Element ? event.target : null;
      cursor.classList.toggle(
        "cursor-hover",
        Boolean(target?.closest(interactiveSelector))
      );

      if (!frameId) {
        frameId = requestAnimationFrame(applyPosition);
      }
    };

    const hideCursor = () => {
      cursor.classList.remove("cursor-visible", "cursor-hover");
    };

    document.documentElement.classList.add("custom-cursor-enabled");
    window.addEventListener("mousemove", moveCursor, { passive: true });
    document.addEventListener("mouseleave", hideCursor);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      document.documentElement.classList.remove("custom-cursor-enabled");
      window.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseleave", hideCursor);
    };
  }, []);

  return <div className="cursor" ref={cursorRef} />;
}
