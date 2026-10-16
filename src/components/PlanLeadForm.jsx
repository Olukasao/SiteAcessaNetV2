import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Send } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { checkCep } from "./CoverageForm";
import { useUI } from "../context/UIContext";
import { coveredCitiesLabel } from "../data/site";
import { contractLink } from "../lib/contract";
import { postJson } from "../lib/api";

// Pedido de assinatura: vai para o backend da AcessaNet e aparece no admin,
// aba "Leads" (/admin/leads). O WhatsApp continua como alternativa.
const periods = [
  { id: "manha", label: "Manhã" },
  { id: "tarde", label: "Tarde" },
  { id: "noite", label: "Noite" },
  { id: "qualquer", label: "Qualquer horário" },
];

const maskCep = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

const maskPhone = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export default function PlanLeadForm({ plan, onBack }) {
  const { coverage, setCoverage } = useUI();
  const [form, setForm] = useState(() => ({
    name: "",
    phone: "",
    cep: coverage?.cep || "",
    street: coverage?.street || "",
    number: "",
    complement: "",
    district: coverage?.district || "",
    city: coverage?.city || "",
    uf: coverage?.uf || "",
    contactPeriod: "",
    website: "",
  }));
  const [cepState, setCepState] = useState(coverage?.status || "idle"); // idle | loading | ok | no | notfound | error
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");
  const lastCep = useRef(coverage?.cep?.replace(/\D/g, "") || "");

  const set = (field, value) => {
    setError("");
    setForm((f) => ({ ...f, [field]: value }));
  };

  // Ao completar o CEP, preenche rua/bairro/cidade (ViaCEP) e confere a cobertura.
  useEffect(() => {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastCep.current) return;
    lastCep.current = digits;
    let cancelled = false;
    setCepState("loading");
    checkCep(digits)
      .then((r) => {
        if (cancelled) return;
        setCepState(r.status);
        if (r.status === "ok" || r.status === "no") {
          setCoverage(r);
          setForm((f) => ({
            ...f,
            street: r.street || f.street,
            district: r.district || f.district,
            city: r.city || f.city,
            uf: r.uf || f.uf,
          }));
        }
      })
      .catch(() => !cancelled && setCepState("error"));
    return () => {
      cancelled = true;
    };
  }, [form.cep, setCoverage]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.phone.replace(/\D/g, "").length < 10) {
      setError("Informe um telefone com DDD.");
      return;
    }
    if (form.cep.replace(/\D/g, "").length !== 8) {
      setError("Informe o CEP completo.");
      return;
    }
    setStatus("sending");
    try {
      await postJson("/api/leads/plan", {
        planId: plan.id,
        planName: plan.name,
        planPrice: plan.priceText,
        name: form.name,
        phone: form.phone,
        cep: form.cep,
        street: form.street,
        number: form.number,
        complement: form.complement || null,
        district: form.district || null,
        city: form.city,
        uf: form.uf || null,
        contactPeriod: form.contactPeriod || null,
        coverageOk: cepState === "ok",
        website: form.website || null,
      });
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setError(err.message || "Não foi possível enviar agora. Tente novamente.");
    }
  };

  if (status === "sent") {
    return (
      <div className="plf-done" role="status">
        <CheckCircle2 size={48} aria-hidden="true" />
        <h3>Pedido recebido!</h3>
        <p>
          Obrigado, {form.name.split(" ")[0]}. Nossa equipe comercial vai entrar em contato
          {form.contactPeriod && form.contactPeriod !== "qualquer"
            ? ` no período da ${periods.find((p) => p.id === form.contactPeriod)?.label.toLowerCase()}`
            : ""}{" "}
          pelo {form.phone} para confirmar a instalação do {plan.name}.
        </p>
      </div>
    );
  }

  const cepHint = {
    loading: { tone: "info", text: "Consultando CEP…" },
    ok: { tone: "ok", text: `${form.city} está na nossa área de cobertura.` },
    no: { tone: "warn", text: `Ainda não atendemos ${form.city}. Envie mesmo assim: avisamos quando a fibra chegar aí.` },
    notfound: { tone: "warn", text: "CEP não encontrado. Confira os números ou preencha o endereço manualmente." },
    error: { tone: "warn", text: "Não foi possível consultar o CEP agora. Preencha o endereço manualmente." },
  }[cepState];

  return (
    <form className="plf" onSubmit={onSubmit}>
      <button type="button" className="plf-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Voltar aos detalhes
      </button>

      <div className="plf-plan">
        <span>Plano escolhido</span>
        <strong>{plan.name}</strong>
        <em>{plan.priceText}/mês</em>
      </div>

      <label className="plf-field">
        <span>Nome completo</span>
        <input data-autofocus name="name" autoComplete="name" required minLength={3} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </label>

      <label className="plf-field">
        <span>Telefone / WhatsApp</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          placeholder="(11) 99999-9999"
          value={form.phone}
          onChange={(e) => set("phone", maskPhone(e.target.value))}
        />
      </label>

      <div className="plf-row plf-row--cep">
        <label className="plf-field">
          <span>CEP</span>
          <input
            name="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            required
            placeholder="00000-000"
            maxLength={9}
            value={form.cep}
            onChange={(e) => set("cep", maskCep(e.target.value))}
          />
        </label>
        {cepHint && (
          <p className={`plf-cep-hint is-${cepHint.tone}`}>
            {cepState === "loading" ? <Loader2 size={15} className="plf-spin" aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}
            {cepHint.text}
          </p>
        )}
      </div>

      <div className="plf-row plf-row--street">
        <label className="plf-field">
          <span>Rua</span>
          <input name="street" autoComplete="address-line1" required value={form.street} onChange={(e) => set("street", e.target.value)} />
        </label>
        <label className="plf-field">
          <span>Número</span>
          <input name="number" inputMode="numeric" required value={form.number} onChange={(e) => set("number", e.target.value)} />
        </label>
      </div>

      <div className="plf-row">
        <label className="plf-field">
          <span>Complemento <small>(opcional)</small></span>
          <input name="complement" autoComplete="address-line2" value={form.complement} onChange={(e) => set("complement", e.target.value)} />
        </label>
        <label className="plf-field">
          <span>Bairro</span>
          <input name="district" value={form.district} onChange={(e) => set("district", e.target.value)} />
        </label>
      </div>

      <label className="plf-field">
        <span>Cidade</span>
        <input name="city" autoComplete="address-level2" required value={form.city} onChange={(e) => set("city", e.target.value)} />
      </label>

      <fieldset className="plf-periods">
        <legend>Melhor horário para falarmos com você</legend>
        <div>
          {periods.map((p) => (
            <label key={p.id} className={form.contactPeriod === p.id ? "is-on" : ""}>
              <input type="radio" name="contactPeriod" value={p.id} checked={form.contactPeriod === p.id} onChange={() => set("contactPeriod", p.id)} />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Campo isca contra robôs: escondido de pessoas e de leitores de tela. */}
      <input className="plf-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => set("website", e.target.value)} />

      {error && <p className="plf-error" role="alert">{error}</p>}

      <button type="submit" className="btn btn--primary btn--block" disabled={status === "sending"}>
        {status === "sending" ? (
          <><Loader2 size={18} className="plf-spin" aria-hidden="true" /> Enviando…</>
        ) : (
          <><Send size={18} aria-hidden="true" /> Enviar pedido</>
        )}
      </button>
      <a className="plf-whats" href={contractLink(plan, coverage)} target="_blank" rel="noreferrer">
        <FaWhatsapp aria-hidden="true" /> Prefere falar agora? Chame no WhatsApp
      </a>
      <p className="pm-legal">
        Atendemos {coveredCitiesLabel}. A contratação é concluída com nossa equipe comercial, que confirma a viabilidade técnica no seu endereço e as condições vigentes.
      </p>
    </form>
  );
}
