import { useEffect, useRef, useState } from "react";
import { useDeviceTier } from "../hooks/useDeviceTier";
import "./globe.css";

// O fallback (Terra em CSS puro) é renderizado SEMPRE primeiro: zero JS de
// terceiros, zero atraso de leitura. O WebGL só sobe depois do primeiro
// paint, em idle, com as texturas já carregadas, e faz crossfade por cima.
export default function Globe() {
  const tier = useDeviceTier();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (tier === "static") return undefined;
    let scene;
    let io;
    let cancelled = false;
    let inView = true;
    const onVis = () => scene?.setVisible(!document.hidden && inView);

    const boot = async () => {
      try {
        const { GlobeScene } = await import("../three/GlobeScene.js");
        if (cancelled || !canvasRef.current) return;
        scene = await GlobeScene.create(canvasRef.current, { tier, onReady: () => setReady(true) });
        if (cancelled) {
          scene.dispose();
          return;
        }
      } catch {
        return; // WebGL/textura/shader falhou: a Terra em CSS continua visível
      }
      io = new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;
          scene.setVisible(inView && !document.hidden);
        },
        { threshold: 0.01 }
      );
      io.observe(wrapRef.current);
      document.addEventListener("visibilitychange", onVis);
    };

    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const handle = idle(boot, { timeout: 1200 });

    return () => {
      cancelled = true;
      (window.cancelIdleCallback || clearTimeout)(handle);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      scene?.dispose();
    };
  }, [tier]);

  return (
    <div ref={wrapRef} className={`globe ${ready ? "is-ready" : ""}`} aria-hidden="true">
      <div className="globe-static">
        <div className="earth-css">
          <div className="earth-css-map" />
          <div className="earth-css-shade" />
        </div>
      </div>
      {tier !== "static" && <canvas ref={canvasRef} className="globe-canvas" />}
    </div>
  );
}
