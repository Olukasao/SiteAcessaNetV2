import { useEffect, useRef, useState } from "react";
import { useDeviceTier } from "../hooks/useDeviceTier";
import "./globe.css";

// O fallback SVG é renderizado SEMPRE primeiro (zero JS de terceiros, zero
// atraso de leitura). O WebGL só é carregado depois do primeiro paint, em
// idle, e faz crossfade por cima quando está pronto.
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
    const onVis = () => scene?.setVisible(!document.hidden && scene.inView !== false);

    const boot = async () => {
      const { GlobeScene } = await import("../three/GlobeScene.js");
      if (cancelled || !canvasRef.current) return;
      try {
        scene = new GlobeScene(canvasRef.current, { tier, onReady: () => setReady(true) });
      } catch {
        return; // contexto WebGL falhou: o fallback SVG continua visível
      }
      io = new IntersectionObserver(
        ([entry]) => {
          scene.inView = entry.isIntersecting;
          scene.setVisible(entry.isIntersecting && !document.hidden);
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
      <StaticGlobe />
      {tier !== "static" && <canvas ref={canvasRef} className="globe-canvas" />}
    </div>
  );
}

function StaticGlobe() {
  const lats = [-60, -30, 0, 30, 60];
  const lons = [0, 30, 60, 90, 120, 150];
  return (
    <svg className="globe-static" viewBox="0 0 400 400" role="presentation">
      <defs>
        <radialGradient id="gs-core" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#10224a" />
          <stop offset="70%" stopColor="#050b1f" />
          <stop offset="100%" stopColor="#1a3a8a" />
        </radialGradient>
        <radialGradient id="gs-glow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#2f6bff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2f6bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gs-arc" x1="0" x2="1">
          <stop offset="0%" stopColor="#2f6bff" stopOpacity="0" />
          <stop offset="70%" stopColor="#3ad6ff" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <clipPath id="gs-clip">
          <circle cx="200" cy="200" r="150" />
        </clipPath>
      </defs>
      <circle cx="200" cy="200" r="196" fill="url(#gs-glow)" />
      <circle cx="200" cy="200" r="150" fill="url(#gs-core)" />
      <g clipPath="url(#gs-clip)" fill="none" stroke="#4f86ff" strokeOpacity="0.28" strokeWidth="0.8">
        {lats.map((l) => {
          const y = 200 - Math.sin((l * Math.PI) / 180) * 150;
          const rx = Math.cos((l * Math.PI) / 180) * 150;
          return <ellipse key={`la${l}`} cx="200" cy={y} rx={rx} ry={rx * 0.18} />;
        })}
        {lons.map((l) => (
          <ellipse key={`lo${l}`} cx="200" cy="200" rx={Math.abs(Math.cos((l * Math.PI) / 180)) * 150} ry="150" />
        ))}
      </g>
      <g fill="none" strokeWidth="1.6" strokeLinecap="round">
        <path className="gs-arc" d="M150 250 C 170 120, 280 90, 320 150" stroke="url(#gs-arc)" />
        <path className="gs-arc gs-arc--2" d="M150 250 C 110 160, 160 80, 230 70" stroke="url(#gs-arc)" />
        <path className="gs-arc gs-arc--3" d="M150 250 C 210 230, 290 250, 330 230" stroke="url(#gs-arc)" />
      </g>
      <circle cx="150" cy="250" r="4" fill="#fff" />
      <circle className="gs-pulse" cx="150" cy="250" r="10" fill="none" stroke="#8ae8ff" />
    </svg>
  );
}
