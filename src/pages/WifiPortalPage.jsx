import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, postJson } from "../lib/api";
import { maskPhone, onlyDigits } from "../lib/masks";
import logo from "../assets/logo-acessanet-3d.png";
import WifiIntro from "./WifiIntro";
import "./wifiPortal.css";

// Captive portal do Wi-Fi público (Grandstream, fluxo "External Captive Portal").
// O roteador abre esta página com ?login_url=&ap_mac=&client_mac=&ssid=&orig_url=.
// O cadastro vai para o site (que grava e manda os opt-ins para o Marketing) e
// volta com a URL de login do roteador já com um usuário/senha temporários;
// o navegador segue para ela e o roteador libera a internet via RADIUS.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(form) {
  const errors = {};
  const name = form.fullName.trim().replace(/\s+/g, " ");
  if (name.length < 3) errors.fullName = "Informe seu nome completo.";
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Confira o e-mail, ex.: nome@email.com.";
  if (!/^\d{2}9\d{8}$/.test(onlyDigits(form.phone))) errors.phone = "Informe um celular com DDD, como (11) 99999-9999.";
  if (!form.termsAccepted) errors.termsAccepted = "É preciso aceitar as condições para usar o Wi-Fi.";
  return errors;
}

export default function WifiPortalPage() {
  const [params] = useSearchParams();
  const context = useMemo(
    () => ({
      loginUrl: params.get("login_url") || undefined,
      apMac: params.get("ap_mac") || undefined,
      clientMac: params.get("client_mac") || undefined,
      ssid: params.get("ssid") || undefined,
      origUrl: params.get("orig_url") || undefined,
    }),
    [params]
  );
  const fromRouter = Boolean(context.loginUrl);

  const [form, setForm] = useState({ fullName: "", email: "", phone: "", termsAccepted: false, marketingConsent: false });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("form"); // form | sending | connecting | done
  const [submitError, setSubmitError] = useState("");

  // A marca abre o portal toda vez que a pessoa entra na rede. Com "reduzir movimento",
  // é só a tela estática da logo.
  const [showIntro, setShowIntro] = useState(true);
  const [staticIntro] = useState(
    () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    document.title = "Wi-Fi grátis | AcessaNet";
  }, []);

  const set = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setState("sending");
    setSubmitError("");
    try {
      const result = await postJson("/api/wifi/cadastro", {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone,
        termsAccepted: true,
        marketingConsent: form.marketingConsent,
        context,
      });
      if (result?.redirectUrl) {
        setState("connecting");
        // O roteador confere o login no RADIUS e libera a internet.
        window.location.assign(result.redirectUrl);
      } else {
        setState("done");
      }
    } catch (error) {
      setState("form");
      if (error instanceof ApiError && error.status === 429) {
        setSubmitError("Muitas tentativas por aqui. Aguarde alguns minutos e tente de novo.");
      } else if (error instanceof ApiError && error.status === 400) {
        setSubmitError(error.message || "Revise os dados e tente de novo.");
      } else {
        setSubmitError("Não conseguimos concluir agora. Confira se ainda está na rede Wi-Fi e tente de novo.");
      }
    }
  }

  return (
    <main className="wifi-shell">
      {showIntro ? <WifiIntro staticOnly={staticIntro} onComplete={() => setShowIntro(false)} /> : null}
      <div className="wifi-card">
        <img className="wifi-logo" src={logo} alt="AcessaNet" width="877" height="327" />

        {state === "connecting" ? (
          <div className="wifi-status" role="status" aria-live="polite">
            <span className="wifi-spinner" aria-hidden="true" />
            <h1>Conectando…</h1>
            <p>Estamos liberando sua internet. Isso leva só alguns segundos.</p>
          </div>
        ) : state === "done" ? (
          <div className="wifi-status" role="status">
            <h1>Cadastro feito!</h1>
            <p>Para navegar, conecte-se à rede Wi-Fi AcessaNet e abra esta página de novo pelo aviso de login da rede.</p>
          </div>
        ) : (
          <>
            <h1>Wi-Fi grátis</h1>
            <p className="wifi-lead">
              {context.ssid ? <>Você está na rede <strong>{context.ssid}</strong>. </> : null}
              Preencha rapidinho para navegar.
            </p>

            {!fromRouter ? (
              <p className="wifi-notice" role="note">
                Esta página costuma abrir sozinha quando você entra na rede Wi-Fi da AcessaNet.
              </p>
            ) : null}

            <form className="wifi-form" onSubmit={handleSubmit} noValidate>
              {submitError ? (
                <p className="wifi-error-box" role="alert">
                  {submitError}
                </p>
              ) : null}

              <label className="wifi-field">
                <span>Nome completo</span>
                <input
                  name="fullName"
                  autoComplete="name"
                  maxLength={120}
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  aria-invalid={errors.fullName ? true : undefined}
                  aria-describedby={errors.fullName ? "wifi-err-name" : undefined}
                />
                {errors.fullName ? <small id="wifi-err-name">{errors.fullName}</small> : null}
              </label>

              <label className="wifi-field">
                <span>E-mail</span>
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "wifi-err-email" : undefined}
                />
                {errors.email ? <small id="wifi-err-email">{errors.email}</small> : null}
              </label>

              <label className="wifi-field">
                <span>Celular com DDD</span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(e) => set("phone", maskPhone(e.target.value))}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? "wifi-err-phone" : undefined}
                />
                {errors.phone ? <small id="wifi-err-phone">{errors.phone}</small> : null}
              </label>

              <label className="wifi-check">
                <input type="checkbox" checked={form.termsAccepted} onChange={(e) => set("termsAccepted", e.target.checked)} />
                <span>
                  Aceito as <a href="#condicoes">condições de uso</a> da rede Wi-Fi AcessaNet.
                </span>
              </label>
              {errors.termsAccepted ? <small className="wifi-check-error">{errors.termsAccepted}</small> : null}

              <label className="wifi-check">
                <input type="checkbox" checked={form.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
                <span>
                  Quero receber ofertas e novidades da AcessaNet. <small>(opcional)</small>
                </span>
              </label>

              <button type="submit" className="wifi-submit" disabled={state === "sending"}>
                {state === "sending" ? "Enviando…" : "Conectar"}
              </button>
            </form>

            <details className="wifi-terms" id="condicoes">
              <summary>Condições de uso e privacidade</summary>
              <p>
                O Wi-Fi é gratuito e oferecido pela AcessaNet. Usamos seu nome, e-mail e celular para liberar e registrar o acesso,
                como exige o Marco Civil da Internet, e guardamos os registros de conexão pelo prazo da lei.
              </p>
              <p>
                Ofertas e novidades só são enviadas se você marcar a opção acima, e você pode pedir para sair a qualquer momento.
                Não vendemos seus dados. Saiba mais em <a href="/lgpd">Proteção de dados (LGPD)</a>.
              </p>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
