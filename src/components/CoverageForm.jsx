import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";
import { coveredCities, coveredCitiesLabel, whatsappLink } from "../data/site";
import { useUI } from "../context/UIContext";
import "./coverage.css";

const normalize = (s) => s?.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const maskCep = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

// Mesma regra da produção (Disponibilidade.jsx): ViaCEP -> cidade -> lista de
// cidades atendidas. Não é viabilidade por endereço; isso é dito na tela.
export async function checkCep(cep) {
  const clean = cep.replace(/\D/g, "");
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!res.ok) throw new Error("viacep");
  const data = await res.json();
  if (data.erro) return { status: "notfound", cep };
  const covered = coveredCities.some((c) => normalize(c) === normalize(data.localidade));
  return {
    status: covered ? "ok" : "no",
    cep: maskCep(clean),
    city: data.localidade,
    uf: data.uf,
    street: data.logradouro,
    district: data.bairro,
  };
}

export default function CoverageForm({ variant = "light", onCovered, compact = false }) {
  const id = useId();
  const inputRef = useRef(null);
  const { coverage, setCoverage } = useUI();
  const [cep, setCep] = useState(coverage?.cep || "");
  const [state, setState] = useState(coverage ? coverage.status : "idle");
  const [result, setResult] = useState(coverage);

  const submit = async (e) => {
    e.preventDefault();
    if (cep.replace(/\D/g, "").length !== 8) {
      setState("invalid");
      inputRef.current?.focus();
      return;
    }
    setState("loading");
    try {
      const r = await checkCep(cep);
      setResult(r);
      setState(r.status);
      if (r.status === "ok" || r.status === "no") setCoverage(r);
      if (r.status === "ok") onCovered?.(r);
    } catch {
      setState("error");
    }
  };

  const msg = {
    invalid: { tone: "warn", text: "Digite os 8 números do CEP." },
    notfound: { tone: "warn", text: "Não encontramos esse CEP. Confira os números e tente de novo." },
    error: { tone: "warn", text: "Não foi possível consultar agora. Tente de novo ou fale com a gente no WhatsApp." },
  }[state];

  return (
    <div className={`coverage coverage--${variant} ${compact ? "coverage--compact" : ""}`}>
      <form className="coverage-form" onSubmit={submit} noValidate>
        <label htmlFor={id} className="sr-only">CEP</label>
        <MapPin className="coverage-pin" size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          data-autofocus
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Digite seu CEP"
          value={cep}
          maxLength={9}
          aria-invalid={state === "invalid" || state === "notfound"}
          aria-describedby={`${id}-status`}
          onChange={(e) => {
            setCep(maskCep(e.target.value));
            if (state !== "loading") setState("idle");
          }}
        />
        <button className="btn btn--primary" type="submit" disabled={state === "loading"} aria-label={state === "loading" ? "Consultando cobertura" : "Consultar cobertura"}>
          {state === "loading" ? <Loader2 className="spin" size={18} aria-hidden="true" /> : null}
          <span>{state === "loading" ? "Consultando" : "Consultar"}</span>
          {state !== "loading" && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </form>

      <div id={`${id}-status`} className="coverage-status" aria-live="polite">
        <AnimatePresence mode="wait">
          {msg && (
            <motion.p key={state} className={`coverage-msg coverage-msg--${msg.tone}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {msg.text}
            </motion.p>
          )}
          {state === "ok" && result && (
            <motion.div key="ok" className="coverage-result coverage-result--ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <CheckCircle2 size={22} aria-hidden="true" />
              <div>
                <strong>Boa notícia: atendemos {result.city}.</strong>
                <span>
                  {result.street ? `${result.street}, ` : ""}
                  {result.district ? `${result.district} · ` : ""}CEP {result.cep}. A viabilidade do seu endereço é confirmada no atendimento.
                </span>
              </div>
            </motion.div>
          )}
          {state === "no" && result && (
            <motion.div key="no" className="coverage-result coverage-result--no" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <XCircle size={22} aria-hidden="true" />
              <div>
                <strong>Ainda não chegamos em {result.city}.</strong>
                <span>Hoje atendemos {coveredCitiesLabel}. </span>
                <a
                  className="coverage-link"
                  href={whatsappLink(`Olá! Consultei o CEP ${result.cep} em ${result.city} e quero saber quando a AcessaNet chega aqui.`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Avise-me quando chegar
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!compact && <p className="coverage-foot">Atendemos {coveredCitiesLabel}.</p>}
    </div>
  );
}
