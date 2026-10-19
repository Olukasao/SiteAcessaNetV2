import { useEffect, useRef, useState } from "react";
import { loadFrameSequence, playFrameSequence } from "../lib/frameSequence";
import { loadH264Sequence, playH264Sequence, supportsWebCodecs } from "../lib/h264Sequence";
import "./wifiIntro.css";

// Abertura do captive portal, antes do formulário: automática, sem toque e sem botões.
// Tela da marca → vídeo do globo por cima. Se o aparelho bloqueia autoplay (iPhone em
// economia, mini-navegador do portal), a mesma animação toca num <canvas> (WebCodecs ou
// quadros WebP). Falha ou rede lenta: a marca segura uns instantes e libera o cadastro.
// Nunca bloqueia a autenticação.

const BLOCKED_CHECK_MS = 1200;
const START_TIMEOUT_MS = 6000;
const END_GRACE_MS = 800;
const STALL_MAX_MS = 1500;
const SPLASH_MIN_MS = 2200;
const INTRO_HARD_CAP_MS = 12000;

const isPortrait = () =>
  typeof window.matchMedia !== "function" || window.matchMedia("(max-aspect-ratio: 1/1)").matches;

export default function WifiIntro({ onComplete, staticOnly = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const completedRef = useRef(false);
  const modeRef = useRef("loading");
  const animStartedRef = useRef(false);
  const playbackRef = useRef(null);
  const timersRef = useRef([]);
  const mountedAtRef = useRef(Date.now());
  const [mode, setMode] = useState("loading");

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };
  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };
  const enterMode = (next) => {
    modeRef.current = next;
    setMode(next);
  };

  const switchToAnim = () => {
    if (completedRef.current || animStartedRef.current || modeRef.current === "video") return;
    animStartedRef.current = true;
    videoRef.current?.pause();
    const portrait = isPortrait();
    const onEnd = () => later(finish, END_GRACE_MS);

    const playFrames = () =>
      loadFrameSequence(portrait ? "/intro/globe-portrait.frames" : "/intro/globe-landscape.frames").then((seq) => {
        const canvas = canvasRef.current;
        if (completedRef.current || !canvas) return;
        const playback = playFrameSequence(canvas, seq, onEnd);
        playbackRef.current = playback;
        return playback.started.then(() => enterMode("anim"));
      });

    const playH264 = () =>
      loadH264Sequence(portrait ? "/intro/globe-portrait.h264seq" : "/intro/globe-landscape.h264seq").then((seq) => {
        const canvas = canvasRef.current;
        if (completedRef.current || !canvas) return;
        const playback = playH264Sequence(canvas, seq, onEnd);
        playbackRef.current = playback;
        return playback.started.then(() => enterMode("anim"));
      });

    (supportsWebCodecs()
      ? playH264().catch(() => {
          playbackRef.current?.stop();
          return playFrames();
        })
      : playFrames()
    ).catch(() => {
      later(finish, Math.max(800, SPLASH_MIN_MS - (Date.now() - mountedAtRef.current)));
    });
  };

  // Um <source> que não casa com a tela também dispara `error`; só desiste sem fonte tocável.
  const handleMediaError = () => {
    later(() => {
      const video = videoRef.current;
      if (!video || video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) switchToAnim();
    }, 50);
  };

  useEffect(() => {
    if (staticOnly) {
      later(finish, SPLASH_MIN_MS);
      return () => timersRef.current.forEach(clearTimeout);
    }

    const video = videoRef.current;
    later(finish, INTRO_HARD_CAP_MS);
    later(() => {
      if (modeRef.current === "loading") finish();
    }, START_TIMEOUT_MS);
    later(() => {
      if (video && modeRef.current === "loading" && video.paused && video.readyState >= 2) switchToAnim();
    }, BLOCKED_CHECK_MS);

    let endTimer;
    let stallTimer;
    const onPlaying = () => {
      if (!video || animStartedRef.current) return;
      enterMode("video");
      clearTimeout(stallTimer);
      clearTimeout(endTimer);
      const remaining = Number.isFinite(video.duration) ? video.duration - video.currentTime : 4;
      endTimer = setTimeout(finish, remaining * 1000 + END_GRACE_MS);
    };
    const onWaiting = () => {
      clearTimeout(endTimer);
      clearTimeout(stallTimer);
      stallTimer = setTimeout(finish, STALL_MAX_MS);
    };

    if (video) {
      video.addEventListener("playing", onPlaying);
      video.addEventListener("waiting", onWaiting);
      video.muted = true;
      video.defaultMuted = true;
      video.play()?.then(undefined, (err) => {
        if (err?.name === "AbortError" || !video.paused) return;
        switchToAnim();
      });
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      clearTimeout(endTimer);
      clearTimeout(stallTimer);
      video?.removeEventListener("playing", onPlaying);
      video?.removeEventListener("waiting", onWaiting);
      playbackRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wifi-intro">
      <div className="wifi-intro__splash" aria-label="AcessaNet">
        <img className="wifi-intro__logo" src="/brand/logo-acessanet-splash.webp" width="880" height="328" alt="AcessaNet" />
        <p className="wifi-intro__tagline">
          Conecte-se ao que <b>importa.</b>
        </p>
      </div>

      {!staticOnly && (
        <video
          ref={videoRef}
          className="wifi-intro__media wifi-intro__video"
          style={{ opacity: mode === "video" ? 1 : 0 }}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          onEnded={finish}
          onError={handleMediaError}
        >
          <source src="/intro/globe-portrait.mp4" type="video/mp4" media="(max-aspect-ratio: 1/1)" />
          <source src="/intro/globe-portrait.webm" type="video/webm" media="(max-aspect-ratio: 1/1)" />
          <source src="/intro/globe-landscape.mp4" type="video/mp4" />
          <source src="/intro/globe-landscape.webm" type="video/webm" onError={handleMediaError} />
        </video>
      )}

      {!staticOnly && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="wifi-intro__media wifi-intro__canvas"
          style={{ opacity: mode === "anim" ? 1 : 0 }}
        />
      )}
    </div>
  );
}
