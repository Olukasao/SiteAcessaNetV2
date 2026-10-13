import { useEffect, useState } from "react";

// Decide quanto efeito visual o aparelho aguenta. Nunca bloqueia o primeiro
// paint: o default "static" é seguro e o globo 3D só sobe depois do mount.
//   "static" -> sem WebGL (reduced-motion, economia de dados, aparelho fraco, sem WebGL)
//   "lite"   -> WebGL com menos pontos/arcos e DPR baixo (celular/tablet)
//   "full"   -> desktop com folga
export function detectTier() {
  if (typeof window === "undefined") return "static";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conn = navigator.connection;
  const saveData = conn?.saveData || /2g/.test(conn?.effectiveType || "");
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  const force = new URLSearchParams(window.location.search).get("gl"); // ?gl=force|off (testes)
  if (force === "off") return "static";
  if (!force && (reduced || saveData || cores <= 2 || memory <= 2)) return "static";

  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return "static";
    // WebGL por software (sem GPU) trava a thread principal -- e o texto do
    // hero junto. Nesses casos o fallback estático é a experiência melhor.
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (!force && /swiftshader|llvmpipe|software|basic render/i.test(String(renderer))) return "static";
  } catch {
    return "static";
  }
  if (force === "force") return window.innerWidth < 900 ? "lite" : "full";

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = window.innerWidth < 900;
  if (coarse || small || cores <= 4 || memory <= 4) return "lite";
  return "full";
}

export function useDeviceTier() {
  const [tier, setTier] = useState("static");
  useEffect(() => {
    setTier(detectTier());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setTier(detectTier());
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return tier;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
