import { useEffect, useRef, useState } from "react";
import { WIFI_WAIT_SECONDS, wifiAds } from "../data/wifiAds";

const ROTATE_MS = 3500;

// Tela entre o cadastro e a liberação: anúncios + "Aguarde N segundos". Ao zerar,
// libera sozinha (onDone) e também há o botão, caso o aparelho segure os timers.
export default function WifiAdBreak({ onDone }) {
  const [left, setLeft] = useState(WIFI_WAIT_SECONDS);
  const [index, setIndex] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const endAt = Date.now() + WIFI_WAIT_SECONDS * 1000;
    const tick = setInterval(() => {
      setLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (wifiAds.length < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % wifiAds.length), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const ready = left === 0;
  useEffect(() => {
    if (ready && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [ready, onDone]);

  const ad = wifiAds[index];
  const progress = ((WIFI_WAIT_SECONDS - left) / WIFI_WAIT_SECONDS) * 100;

  return (
    <div className="wifi-ads" role="status" aria-live="polite">
      <h1>Cadastro feito!</h1>
      {ad ? (
        <article className="wifi-ad" key={ad.id}>
          <span className="wifi-ad__tag">{ad.tag}</span>
          <h2>{ad.title}</h2>
          <p>{ad.text}</p>
          <strong>{ad.cta}</strong>
        </article>
      ) : null}
      {wifiAds.length > 1 ? (
        <div className="wifi-ad-dots" aria-hidden="true">
          {wifiAds.map((item, i) => (
            <span key={item.id} className={i === index ? "is-on" : ""} />
          ))}
        </div>
      ) : null}
      <div className="wifi-countdown">
        <div className="wifi-countdown__bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p>
          {ready ? "Liberando sua internet…" : <>Aguarde <strong>{left}</strong> {left === 1 ? "segundo" : "segundos"} para a liberação da internet grátis</>}
        </p>
      </div>
    </div>
  );
}
