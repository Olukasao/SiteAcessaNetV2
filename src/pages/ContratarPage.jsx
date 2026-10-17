import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  MapPin,
  Send,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { checkCep } from "../components/CoverageForm";
import { useUI } from "../context/UIContext";
import { plans as sitePlans, services, whatsappLink } from "../data/site";
import { ApiError, getJson, postJson } from "../lib/api";
import { contractLink } from "../lib/contract";
import { maskCep, maskPhone, onlyDigits } from "../lib/masks";
import "../sections/sections.css";
import "../components/planModal.css";
import "../components/planCard.css";
import "./contratar.css";

// Solicitação de Contratação Online. Preço, nome, benefícios e cidades
// atendidas vêm do backend (GET /api/contratacao/planos); daqui só saem
// logos/variante/selo (apresentação). Nada de dado pessoal vai para a URL:
// só ?plano=<id>.

const STEPS = ["Plano e endereço", "Seus dados", "Revisão"];

const periods = [
  { id: "manha", label: "Manhã" },
  { id: "tarde", label: "Tarde" },
  { id: "noite", label: "Noite" },
  { id: "qualquer", label: "Qualquer horário" },
];

const NOTES_MAX = 500;
const RATE_LIMIT_SECONDS = 30;
// Acima disso não faz sentido contagem regressiva: orienta a tentar mais tarde.
const RATE_LIMIT_COUNTDOWN_MAX = 120;
const LEGAL =
  "A contratação é concluída com nossa equipe comercial, que confirma a viabilidade técnica no seu endereço e as condições vigentes.";

// Campos por etapa, na ordem visual (o primeiro inválido recebe o foco).
const ADDRESS_FIELDS = ["cep", "street", "number", "district", "city", "uf"];
const CONTACT_FIELDS = ["name", "whatsapp", "email", "notes"];
const FIELD_STEP = Object.fromEntries([...ADDRESS_FIELDS.map((f) => [f, 1]), ...CONTACT_FIELDS.map((f) => [f, 2])]);
const FIELD_LABEL = {
  cep: "CEP",
  street: "Rua",
  number: "Número",
  district: "Bairro",
  city: "Cidade",
  uf: "UF",
  name: "Nome completo",
  whatsapp: "WhatsApp",
  email: "E-mail",
  notes: "Ponto de referência ou observação",
};

/** DDDs válidos no Brasil (mesma lista do servidor). */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92,
  93, 94, 95, 96, 97, 98, 99,
]);
const NAME_PATTERN = /^[\p{L}][\p{L}' .-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const normalize = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Validação espelhando o schema do servidor (contractRequestRoutes.ts).
const validators = {
  cep: (v) => (onlyDigits(v).length === 8 ? "" : "Digite os 8 números do CEP."),
  street: (v) => (v.trim().length >= 2 ? "" : "Informe a rua."),
  number: (v) => (v.trim().length >= 1 && v.trim().length <= 20 ? "" : "Informe o número ou S/N."),
  district: (v) => (v.trim().length >= 2 ? "" : "Informe o bairro."),
  city: (v) => (v.trim().length >= 2 ? "" : "Informe a cidade."),
  uf: (v) => (!v.trim() || /^[A-Za-z]{2}$/.test(v.trim()) ? "" : "Use a sigla do estado, como SP."),
  name: (v) => {
    const name = v.trim().replace(/\s+/g, " ");
    if (name.length < 5 || name.split(" ").filter((p) => p.length >= 2).length < 2) return "Informe seu nome completo.";
    if (name.length > 120) return "Use no máximo 120 caracteres.";
    if (!NAME_PATTERN.test(name)) return "Use apenas letras no nome.";
    return "";
  },
  whatsapp: (v) => {
    const d = onlyDigits(v);
    const ok = (d.length === 10 || d.length === 11) && VALID_DDDS.has(Number(d.slice(0, 2))) && (d.length === 10 || d[2] === "9");
    return ok ? "" : "Informe um celular com DDD, como (11) 99999-9999.";
  },
  email: (v) => (!v.trim() || (v.trim().length <= 254 && EMAIL_PATTERN.test(v.trim())) ? "" : "Confira o e-mail, ex.: nome@email.com."),
  notes: (v) => (v.length <= NOTES_MAX ? "" : `Use no máximo ${NOTES_MAX} caracteres.`),
};

function validateFields(form, fields) {
  const errs = {};
  for (const f of fields) {
    const msg = validators[f](form[f]);
    if (msg) errs[f] = msg;
  }
  return errs;
}

// Chave de idempotência (uuid v4): 1 por sessão do formulário.
function newIdempotencyKey() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Junta o plano do backend com a apresentação do site (variante, selo, logos).
function decoratePlan(p) {
  const site = sitePlans.find((s) => s.id === p.id);
  const [int = "", cents = "00"] = String(p.priceText).replace(/^R\$\s*/, "").split(",");
  return { ...p, variant: site?.variant || "", badge: site?.badge || "", short: site?.short || `${p.speed} ${p.unit}`, price: { int, cents } };
}

function emptyForm(coverage) {
  const fromCoverage = coverage && (coverage.status === "ok" || coverage.status === "no");
  return {
    cep: coverage?.cep || "",
    street: fromCoverage ? coverage.street || "" : "",
    number: "",
    complement: "",
    district: fromCoverage ? coverage.district || "" : "",
    city: fromCoverage ? coverage.city || "" : "",
    uf: fromCoverage ? coverage.uf || "" : "",
    name: "",
    whatsapp: "",
    email: "",
    contactPeriod: "",
    notes: "",
    marketingOptIn: false,
    website: "",
  };
}

const mobileQuery = "(max-width: 900px)";
function subscribeMobile(cb) {
  const mq = window.matchMedia(mobileQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const useIsMobile = () =>
  useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false);

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Peças de apresentação ---------- */

function BenefitIcon({ benefitKey, variant }) {
  const s = services[benefitKey];
  if (variant === "light") {
    return (
      <span className={`pm-ico ${s?.logo ? "pm-ico--logo" : ""} ${s?.dark ? "is-dark" : ""} ${s?.fit === "pad" ? "is-pad" : ""} ${!s?.logo && s?.icon ? "is-glyph" : ""}`} aria-hidden="true">
        {s?.logo ? <img src={s.logo} alt="" loading="lazy" /> : s?.icon ? <s.icon size={15} /> : <Check size={14} />}
      </span>
    );
  }
  const Glyph = s?.icon;
  const tone = s?.logo ? `is-logo ${s.dark ? "is-dark" : ""} ${s.fit === "pad" ? "is-pad" : ""}` : Glyph ? "is-glyph" : "";
  return (
    <span className={`plan-include-icon ${tone}`} aria-hidden="true">
      {s?.logo ? <img src={s.logo} alt="" loading="lazy" /> : Glyph ? <Glyph size={17} /> : <Check size={16} />}
    </span>
  );
}

function Field({ id, label, optional, help, error, extraDescribedBy, children, className = "" }) {
  const describedBy = [help ? `${id}-help` : null, extraDescribedBy, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`plf-field ${className}`}>
      <label htmlFor={id}>
        {label} {optional && <small>(opcional)</small>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {help && (
        <p id={`${id}-help`} className="ctr-help">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="ctr-field-error">
          <AlertCircle size={14} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

function Stepper({ step }) {
  return (
    <ol className="ctr-steps" aria-label="Etapas da solicitação">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "is-done" : n === step ? "is-current" : "";
        return (
          <li key={label} className={state} aria-current={n === step ? "step" : undefined}>
            <span className="ctr-step-dot">{n < step ? <Check size={16} aria-hidden="true" /> : n}</span>
            <span className="ctr-step-label">{label}</span>
            {n < step && <span className="sr-only"> (concluída)</span>}
          </li>
        );
      })}
    </ol>
  );
}

function StepHead({ headingRef, count, title, lead }) {
  return (
    <header className="ctr-step-head">
      {count && (
        <p className="ctr-step-count" id="ctr-step-count">
          {count}
        </p>
      )}
      <h2 ref={headingRef} id="ctr-step-title" tabIndex={-1} aria-describedby={count ? "ctr-step-count" : undefined}>
        {title}
      </h2>
      <p>{lead}</p>
    </header>
  );
}

function PlanSummary({ plan, isMobile, open, onToggle, onChange, changeDisabled, address }) {
  const firstIsNote = plan.conditions.includes(plan.note);
  return (
    <aside className="ctr-summary" aria-labelledby="ctr-summary-title">
      <h2 id="ctr-summary-title" className="sr-only">
        Resumo do plano
      </h2>
      <button type="button" className="ctr-summary-toggle" aria-expanded={open} aria-controls="ctr-summary-body" onClick={onToggle}>
        <span className="ctr-summary-toggle-text">
          <strong>{plan.short}</strong>
          <span>{plan.priceText}/mês</span>
        </span>
        <span className="ctr-summary-toggle-hint">
          {open ? "Ocultar" : "Detalhes"} <ChevronDown size={16} aria-hidden="true" />
        </span>
      </button>
      <div id="ctr-summary-body" className="ctr-summary-body" hidden={isMobile && !open}>
        <div className="ctr-summary-plan">
          <div className="ctr-summary-top">
            <p className="ctr-summary-kicker">Seu plano</p>
            {onChange && (
              <button type="button" className="ctr-summary-change" disabled={changeDisabled} onClick={onChange}>
                Trocar plano
              </button>
            )}
          </div>
          <p className="ctr-summary-speed">
            {plan.speed} <span>{plan.unit}</span>
          </p>
          {plan.variant && <p className="ctr-summary-variant">{plan.variant}</p>}
        </div>
        <div>
          <p className="pm-price" aria-label={`${plan.priceText} por mês`}>
            <span>R$</span>
            <strong>{plan.price.int}</strong>
            <span>,{plan.price.cents}</span>
            <small>/mês</small>
          </p>
          {!firstIsNote && plan.note && <p className="ctr-summary-note">{plan.note}</p>}
        </div>
        <ul className="ctr-summary-list" aria-label="Incluso no plano">
          <li>
            <span className="plan-include-icon" aria-hidden="true">
              <Check size={16} />
            </span>
            <span>
              {plan.speed} {plan.unit}
              <small>Internet fibra óptica</small>
            </span>
          </li>
          {plan.benefits.map((b) => (
            <li key={b.key}>
              <BenefitIcon benefitKey={b.key} />
              <span>
                {b.name}
                <small>{b.detail}</small>
              </span>
            </li>
          ))}
        </ul>
        {plan.conditions.length > 0 && (
          <ul className="ctr-conditions" aria-label="Condições">
            {plan.conditions.map((c) => (
              <li key={c}>
                <ShieldCheck size={15} aria-hidden="true" /> {c}
              </li>
            ))}
          </ul>
        )}
        {address && (
          <p className="ctr-summary-address">
            <MapPin size={15} aria-hidden="true" /> Instalação em: {address}
          </p>
        )}
      </div>
    </aside>
  );
}

function CatalogSkeleton({ visible }) {
  return (
    <div className="ctr-layout" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando planos…
      </p>
      {visible && (
        <>
          <div className="ctr-card" aria-hidden="true">
            <div className="ctr-skel" style={{ height: 32 }} />
            <div className="ctr-skel" style={{ height: 28, width: "55%" }} />
            <div className="ctr-skel" style={{ height: 50 }} />
            <div className="ctr-skel" style={{ height: 50 }} />
            <div className="ctr-skel" style={{ height: 50 }} />
          </div>
          <div className="ctr-summary ctr-summary--skel" aria-hidden="true">
            <div className="ctr-skel" style={{ height: 64, width: "60%" }} />
            <div className="ctr-skel" style={{ height: 40, width: "45%" }} />
            <div className="ctr-skel" style={{ height: 160 }} />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Página ---------- */

export default function ContratarPage() {
  const { coverage, setCoverage } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPlanParam = searchParams.get("plano") || "";
  const isMobile = useIsMobile();

  // Catálogo
  const [catalog, setCatalog] = useState({ status: "loading", plans: [], coveredCities: [] });
  const [showSkel, setShowSkel] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Fluxo
  const [step, setStep] = useState(1);
  const [choosing, setChoosing] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planGone, setPlanGone] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  // "Editar" na revisão: depois de corrigir, volta direto para a revisão.
  const [returnToReview, setReturnToReview] = useState(false);

  // Formulário
  const [form, setForm] = useState(() => emptyForm(coverage));
  const [errors, setErrors] = useState({});
  const [serverSummary, setServerSummary] = useState(null); // [{ field, message }]
  const [cepState, setCepState] = useState(() => (coverage?.status === "ok" || coverage?.status === "no" ? "found" : "idle"));
  const [coverageCity, setCoverageCity] = useState(() => (coverage?.status === "ok" || coverage?.status === "no" ? coverage.city || "" : ""));

  // Envio
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [rateBlocked, setRateBlocked] = useState(false);
  const [done, setDone] = useState(null);
  const [copyState, setCopyState] = useState("idle"); // idle | copied | manual
  const [liveMsg, setLiveMsg] = useState("");

  const idempotencyKey = useRef(null);
  if (!idempotencyKey.current) idempotencyKey.current = newIdempotencyKey();
  const sendingRef = useRef(false);
  const lastCep = useRef(onlyDigits(coverage?.cep || ""));
  const autoFilled = useRef({ street: form.street, district: form.district, city: form.city, uf: form.uf });
  const formRef = useRef(form);
  formRef.current = form;
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const summaryErrRef = useRef(null);
  const protocolRef = useRef(null);
  // Pedido de foco após a próxima renderização: "heading" | "summary" | id de campo.
  const pendingFocus = useRef(null);
  const copyTimer = useRef(null);
  const rateTimer = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current);
      clearTimeout(rateTimer.current);
    },
    []
  );

  useEffect(() => {
    document.title = "Solicitar contratação | AcessaNet";
  }, []);

  // Carrega o catálogo; skeleton só depois de 300 ms (evita piscar).
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => setShowSkel(true), 300);
    getJson("/api/contratacao/planos", { signal: ctrl.signal })
      .then((data) => {
        const list = (data?.plans || []).map(decoratePlan).sort((a, b) => b.speed - a.speed);
        if (!list.length) throw new ApiError(500, "Catálogo vazio.");
        setCatalog({ status: "ready", plans: list, coveredCities: data.coveredCities || [] });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setCatalog({ status: "error", plans: [], coveredCities: [] });
      })
      .finally(() => clearTimeout(t));
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [reloadKey]);

  const plan = catalog.plans.find((p) => p.id === rawPlanParam) || null;
  const showChoose = catalog.status === "ready" && (choosing || !plan);

  // Contagem regressiva do rate limit.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Foco/scroll após trocar de etapa (nunca no carregamento inicial).
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const card = cardRef.current;
    if (card) {
      const top = card.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) card.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    const el =
      target === "heading" ? headingRef.current : target === "summary" ? summaryErrRef.current : document.getElementById(`ctr-${target}`);
    el?.focus({ preventScroll: true });
  });

  // ViaCEP ao completar 8 dígitos: preenche só o que está vazio ou veio da consulta anterior.
  useEffect(() => {
    const digits = onlyDigits(form.cep);
    if (digits.length !== 8 || digits === lastCep.current) return undefined;
    lastCep.current = digits;
    let cancelled = false;
    let settled = false;
    // Nova consulta: o resultado de cobertura anterior deixa de valer.
    setCoverageCity("");
    setCepState("loading");
    checkCep(digits)
      .then((r) => {
        if (cancelled) return;
        settled = true;
        if (r.status === "notfound") {
          setCepState("notfound");
          setCoverageCity("");
          return;
        }
        setCepState("found");
        setCoverage(r);
        const f = formRef.current;
        const filled = {};
        for (const key of ["street", "district", "city", "uf"]) {
          if (r[key] && (!f[key].trim() || f[key] === autoFilled.current[key])) filled[key] = r[key];
        }
        autoFilled.current = { ...autoFilled.current, ...filled };
        setForm((cur) => ({ ...cur, ...filled }));
        setCoverageCity((filled.city ?? f.city).trim());
        setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in filled))));
      })
      .catch(() => {
        if (cancelled) return;
        settled = true;
        // Falhou: redigitar o mesmo CEP consulta de novo.
        lastCep.current = "";
        setCepState("error");
      });
    return () => {
      cancelled = true;
      // Consulta abandonada (o CEP mudou antes da resposta): permite repetir.
      if (!settled) lastCep.current = "";
    };
  }, [form.cep, setCoverage]);

  const goTo = useCallback((nextStep, focus = "heading") => {
    pendingFocus.current = focus;
    if (nextStep === 3) setReturnToReview(false);
    setStep(nextStep);
  }, []);

  // CEP incompleto: o aviso de cobertura anterior deixa de valer.
  const onCepChange = (value) => {
    set("cep", maskCep(value));
    if (onlyDigits(value).length < 8) {
      lastCep.current = "";
      setCepState("idle");
      setCoverageCity("");
    }
  };

  const set = (field, value) => {
    setSubmitError("");
    setForm((f) => ({ ...f, [field]: value }));
    // Limpa o erro assim que o valor fica válido (não valida enquanto digita).
    if (errors[field] && validators[field] && !validators[field](value)) {
      setErrors(({ [field]: _removed, ...rest }) => rest);
    }
  };

  const onBlur = (field) => {
    const msg = validators[field](form[field]);
    setErrors((e) => {
      if (msg) return { ...e, [field]: msg };
      const { [field]: _removed, ...rest } = e;
      return rest;
    });
    if (field === "city") setCoverageCity(form.city.trim());
  };

  const cityCovered = coverageCity ? catalog.coveredCities.some((c) => normalize(c) === normalize(coverageCity)) : null;

  const selectPlan = (id) => {
    setChoosing(true);
    setPlanError("");
    setPlanGone(false);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("plano", id);
        return next;
      },
      { replace: true }
    );
  };

  const startChangePlan = () => {
    if (sendingRef.current) return;
    setReturnToReview(step === 3);
    setChoosing(true);
    setSummaryOpen(false);
    goTo(1);
  };

  const confirmPlan = () => {
    if (!plan) {
      setPlanError("Escolha um plano para continuar.");
      document.querySelector(".ctr-plan input")?.focus();
      return;
    }
    setChoosing(false);
    if (returnToReview) advance([...ADDRESS_FIELDS, ...CONTACT_FIELDS], 3);
    else goTo(1);
  };

  const advance = (fields, nextStep) => {
    const errs = validateFields(form, fields);
    setErrors((e) => {
      const kept = Object.fromEntries(Object.entries(e).filter(([k]) => !fields.includes(k)));
      return { ...kept, ...errs };
    });
    const first = fields.find((f) => errs[f]);
    if (first) {
      if (FIELD_STEP[first] === step && !showChoose) document.getElementById(`ctr-${first}`)?.focus();
      else {
        setChoosing(false);
        goTo(FIELD_STEP[first], first);
      }
      return;
    }
    if (fields.includes("city")) setCoverageCity(form.city.trim());
    setServerSummary(null);
    goTo(nextStep);
  };

  // 400 do servidor: o formato é ZodError.flatten() ({ formErrors, fieldErrors }),
  // que só traz o grupo (address/customer/notes). Reaproveita a validação local
  // para achar o campo; se não achar, liga a mensagem do servidor ao 1º campo do grupo.
  const applyServerErrors = (details) => {
    const fe = details?.fieldErrors || {};
    const local = validateFields(form, [...ADDRESS_FIELDS, ...CONTACT_FIELDS]);
    const errs = {};
    const groups = [
      ["address", ADDRESS_FIELDS],
      ["customer", ["name", "whatsapp", "email"]],
      ["notes", ["notes"]],
    ];
    for (const [group, fields] of groups) {
      const msgs = fe[group];
      if (!msgs?.length) continue;
      const found = fields.filter((f) => local[f]);
      if (found.length) {
        for (const f of found) errs[f] = local[f];
        continue;
      }
      const text = msgs.join(" ");
      const guess =
        (/CEP/i.test(text) && "cep") ||
        (/UF/.test(text) && "uf") ||
        (/WhatsApp|DDD|Celular/i.test(text) && "whatsapp") ||
        (/nome/i.test(text) && "name") ||
        (/mail/i.test(text) && "email") ||
        fields[0];
      errs[guess] = msgs[0];
    }
    const fields = [...ADDRESS_FIELDS, ...CONTACT_FIELDS].filter((f) => errs[f]);
    if (!fields.length) return false;
    setErrors(errs);
    setServerSummary(fields.map((f) => ({ field: f, message: errs[f] })));
    setChoosing(false);
    goTo(FIELD_STEP[fields[0]], "summary");
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    // Antes da revisão, o submit (botão ou Enter) só avança, com validação.
    if (showChoose) return confirmPlan();
    if (step === 1) return returnToReview ? advance([...ADDRESS_FIELDS, ...CONTACT_FIELDS], 3) : advance(ADDRESS_FIELDS, 2);
    if (step === 2) return advance(CONTACT_FIELDS, 3);
    if (sendingRef.current || cooldown > 0 || rateBlocked || !plan) return;
    sendingRef.current = true;
    setSending(true);
    setSubmitError("");
    const nullable = (v) => (v.trim() ? v.trim() : null);
    try {
      const res = await postJson("/api/contratacao/solicitacoes", {
        idempotencyKey: idempotencyKey.current,
        planId: plan.id,
        address: {
          cep: maskCep(form.cep),
          street: form.street.trim(),
          number: form.number.trim(),
          complement: nullable(form.complement),
          district: form.district.trim(),
          city: form.city.trim(),
          uf: form.uf.trim() ? form.uf.trim().toUpperCase() : null,
        },
        customer: { name: form.name.trim().replace(/\s+/g, " "), whatsapp: form.whatsapp, email: nullable(form.email) },
        contactPeriod: form.contactPeriod || null,
        notes: nullable(form.notes),
        privacyNoticeAck: true,
        marketingOptIn: form.marketingOptIn,
        website: form.website || null,
      });
      setDone({
        protocol: res.protocol,
        planName: res.plan?.name || plan.name,
        cityCovered: res.coverage?.cityCovered ?? cityCovered !== false,
        firstName: form.name.trim().split(/\s+/)[0],
        city: form.city.trim(),
        period: form.contactPeriod,
      });
      setLiveMsg(`Solicitação enviada. Protocolo ${res.protocol}.`);
      // Limpa o formulário; nova solicitação = nova chave.
      setForm(emptyForm(null));
      idempotencyKey.current = newIdempotencyKey();
      pendingFocus.current = "heading";
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 400) {
        if (!applyServerErrors(err.details)) setSubmitError(err.message || "Revise os dados enviados.");
      } else if (status === 404) {
        setPlanGone(true);
        setChoosing(true);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("plano");
            return next;
          },
          { replace: true }
        );
        setReloadKey((k) => k + 1);
        goTo(1);
      } else if (status === 429) {
        const wait = Number(err.retryAfter) > 0 ? Math.ceil(Number(err.retryAfter)) : RATE_LIMIT_SECONDS;
        if (wait > RATE_LIMIT_COUNTDOWN_MAX) {
          // Bloqueio longo (ex.: 1 h): sem contagem; WhatsApp vira a ação principal.
          setRateBlocked(true);
          clearTimeout(rateTimer.current);
          rateTimer.current = setTimeout(() => setRateBlocked(false), Math.min(wait * 1000, 2 ** 31 - 1));
        } else {
          setSubmitError("rate");
          setCooldown(wait);
        }
      } else if (status === 0) {
        setSubmitError("Não foi possível conectar. Verifique sua internet e tente de novo.");
      } else {
        setSubmitError("Não conseguimos enviar sua solicitação agora. Seus dados continuam aqui: tente de novo em instantes ou fale com a gente no WhatsApp.");
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const copyProtocol = async () => {
    try {
      await navigator.clipboard.writeText(done.protocol);
      setCopyState("copied");
      setLiveMsg("Protocolo copiado");
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      const el = protocolRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setCopyState("manual");
      setLiveMsg("Selecione e copie o protocolo");
    }
  };

  const whatsHref = plan ? contractLink(plan, coverage) : whatsappLink("Olá! Quero contratar um plano da AcessaNet.");
  const addressLine = form.street.trim() && form.number.trim() && form.city.trim() ? `${form.street.trim()}, ${form.number.trim()} — ${form.city.trim()}` : "";
  const summaryAddress = done ? null : step > 1 && !showChoose ? addressLine : null;

  /* ---------- Conteúdo do card ---------- */

  let cardBody;
  if (done) {
    const periodLabel = done.period && done.period !== "qualquer" ? periods.find((p) => p.id === done.period)?.label.toLowerCase() : null;
    cardBody = (
      <div className="ctr-panel ctr-done">
        <CheckCircle2 size={48} aria-hidden="true" />
        <h2 ref={headingRef} tabIndex={-1}>
          Recebemos sua solicitação
        </h2>
        {done.cityCovered ? (
          <p>
            Obrigado, {done.firstName}. Nossa equipe comercial vai confirmar a viabilidade técnica no seu endereço e falar com você pelo WhatsApp
            {periodLabel ? ` no período da ${periodLabel}` : ""} para combinar a instalação do {done.planName}.
          </p>
        ) : (
          <p>
            Obrigado, {done.firstName}. {done.city} ainda não está na nossa área de cobertura, mas sua solicitação foi registrada. Nossa equipe vai analisar e
            falar com você pelo WhatsApp.
          </p>
        )}
        <div className="ctr-protocol">
          <div>
            <span className="ctr-protocol-label">Protocolo</span>
            <span ref={protocolRef} className="ctr-protocol-code">
              {done.protocol}
            </span>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={copyProtocol}>
            {copyState === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copyState === "copied" ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="ctr-protocol-note">
          {copyState === "manual" ? "Selecione e copie o protocolo. " : ""}Guarde este número para falar com a gente sobre sua solicitação.
        </p>
        <section className="ctr-next-wrap" aria-labelledby="ctr-next-done">
          <h3 id="ctr-next-done">Próximos passos</h3>
          <ol className="ctr-next">
            <li>Nossa equipe comercial confirma a viabilidade técnica no seu endereço e as condições vigentes.</li>
            <li>A gente fala com você pelo WhatsApp para combinar a instalação.</li>
          </ol>
        </section>
        <div className="ctr-done-actions">
          <a className="btn btn--ghost" href={whatsappLink(`Olá! Enviei uma solicitação de contratação pelo site. Protocolo ${done.protocol}.`)} target="_blank" rel="noreferrer">
            <FaWhatsapp aria-hidden="true" /> Falar no WhatsApp
          </a>
          <Link to="/" className="ctr-back">
            Voltar para o início
          </Link>
        </div>
      </div>
    );
  } else if (showChoose) {
    cardBody = (
      <div className="ctr-panel" key="choose">
        <StepHead
          headingRef={headingRef}
          count="Etapa 1 de 3"
          title="Qual plano você quer contratar?"
          lead="Todos com internet 100% fibra óptica. Você poderá trocar antes de enviar."
        />
        {planGone ? (
          <p className="ctr-notice is-warn" role="alert">
            Esse plano não está mais disponível. Escolha outro plano: seus dados continuam preenchidos.
          </p>
        ) : (
          rawPlanParam &&
          !plan && (
            <p className="ctr-notice is-warn" role="status">
              Não encontramos o plano do link. Escolha um dos planos abaixo.
            </p>
          )
        )}
        <fieldset className="ctr-plans" aria-describedby={planError ? "ctr-plan-err" : undefined}>
          <legend className="sr-only">Planos disponíveis</legend>
          {catalog.plans.map((p) => (
            <label key={p.id} className={`ctr-plan ${plan?.id === p.id ? "is-on" : ""}`}>
              <input type="radio" name="plano" value={p.id} checked={plan?.id === p.id} onChange={() => selectPlan(p.id)} />
              <span className="ctr-plan-speed">
                {p.speed}
                <span>{p.unit}</span>
              </span>
              <span className="ctr-plan-variant">{p.variant ? `Internet fibra óptica ${p.variant}` : "Internet fibra óptica"}</span>
              <span className="ctr-plan-price">
                {p.priceText}
                <small>/mês</small>
              </span>
              <span className="ctr-plan-icons">
                {p.benefits.map((b) => (
                  <BenefitIcon key={b.key} benefitKey={b.key} variant="light" />
                ))}
                <span className="sr-only">Inclui {p.benefits.map((b) => b.name).join(", ")}</span>
              </span>
              {p.badge && <span className="ctr-plan-badge">{p.badge}</span>}
            </label>
          ))}
        </fieldset>
        {planError && (
          <p id="ctr-plan-err" className="ctr-field-error">
            <AlertCircle size={14} aria-hidden="true" /> {planError}
          </p>
        )}
        <div className="ctr-actions ctr-actions--end">
          <button type="submit" className="btn btn--primary">
            {returnToReview ? "Voltar à revisão" : "Continuar com este plano"} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  } else if (step === 1) {
    // Carregando/erro têm prioridade sobre a cobertura; sem consulta, o espaço
    // do aviso traz a ajuda do campo.
    const hint =
      cepState === "loading"
        ? { tone: "info", text: "Consultando o CEP…" }
        : cepState === "error"
          ? { tone: "warn", text: "Não foi possível consultar o CEP agora. Preencha o endereço manualmente." }
          : cepState === "notfound"
            ? { tone: "warn", text: "Não encontramos esse CEP. Confira os números ou preencha o endereço manualmente." }
            : coverageCity
              ? cityCovered
                ? { tone: "ok", text: `Atendemos ${coverageCity}. A disponibilidade no seu endereço é confirmada pela nossa equipe depois do envio.` }
                : { tone: "warn", text: `Ainda não atendemos ${coverageCity}. Você pode enviar mesmo assim: nossa equipe analisa e retorna pelo WhatsApp.` }
              : { tone: "info", text: "Não sabe o CEP? Preencha o endereço manualmente." };
    cardBody = (
      <div className="ctr-panel" key="s1">
        <StepHead headingRef={headingRef} count="Etapa 1 de 3" title="Endereço de instalação" lead="Comece pelo CEP: a gente preenche o resto para você conferir." />
        <div className="plf-row plf-row--cep">
          <Field id="ctr-cep" label="CEP" error={errors.cep} extraDescribedBy="ctr-cep-status">
            {(a) => (
              <input
                {...a}
                name="cep"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                maxLength={9}
                value={form.cep}
                onChange={(e) => onCepChange(e.target.value)}
                onBlur={() => onBlur("cep")}
              />
            )}
          </Field>
          <div id="ctr-cep-status" className="ctr-cep-status" aria-live="polite">
            {hint && (
              <p className={`plf-cep-hint is-${hint.tone}`}>
                {cepState === "loading" ? <Loader2 size={15} className="plf-spin" aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}
                {hint.text}
              </p>
            )}
          </div>
        </div>
        <div className="plf-row plf-row--street">
          <Field id="ctr-street" label="Rua" error={errors.street}>
            {(a) => <input {...a} name="street" autoComplete="address-line1" value={form.street} onChange={(e) => set("street", e.target.value)} onBlur={() => onBlur("street")} />}
          </Field>
          <Field id="ctr-number" label="Número" help="Sem número? Use S/N." error={errors.number}>
            {(a) => <input {...a} name="number" inputMode="text" maxLength={20} value={form.number} onChange={(e) => set("number", e.target.value)} onBlur={() => onBlur("number")} />}
          </Field>
        </div>
        <div className="plf-row">
          <Field id="ctr-complement" label="Complemento" optional>
            {(a) => (
              <input
                {...a}
                name="complement"
                autoComplete="address-line2"
                maxLength={120}
                placeholder="Casa 2, bloco B, apto 31"
                value={form.complement}
                onChange={(e) => set("complement", e.target.value)}
              />
            )}
          </Field>
          <Field id="ctr-district" label="Bairro" error={errors.district}>
            {(a) => <input {...a} name="district" autoComplete="address-level3" maxLength={120} value={form.district} onChange={(e) => set("district", e.target.value)} onBlur={() => onBlur("district")} />}
          </Field>
        </div>
        <div className="plf-row ctr-row--city">
          <Field id="ctr-city" label="Cidade" error={errors.city}>
            {(a) => <input {...a} name="city" autoComplete="address-level2" maxLength={120} value={form.city} onChange={(e) => set("city", e.target.value)} onBlur={() => onBlur("city")} />}
          </Field>
          <Field id="ctr-uf" label="UF" optional error={errors.uf}>
            {(a) => (
              <input
                {...a}
                name="uf"
                autoComplete="address-level1"
                autoCapitalize="characters"
                maxLength={2}
                value={form.uf}
                onChange={(e) => set("uf", e.target.value.toUpperCase())}
                onBlur={() => onBlur("uf")}
              />
            )}
          </Field>
        </div>
        <div className="ctr-actions ctr-actions--end">
          <button type="submit" className="btn btn--primary">
            {returnToReview ? "Voltar à revisão" : "Continuar"} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  } else if (step === 2) {
    cardBody = (
      <div className="ctr-panel" key="s2">
        <StepHead headingRef={headingRef} count="Etapa 2 de 3" title="Seus dados" lead="Para nossa equipe comercial falar com você sobre a instalação." />
        <Field id="ctr-name" label="Nome completo" error={errors.name}>
          {(a) => <input {...a} name="name" autoComplete="name" maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} onBlur={() => onBlur("name")} />}
        </Field>
        <div className="plf-row">
          <Field id="ctr-whatsapp" label="WhatsApp" help="É por aqui que nossa equipe vai falar com você." error={errors.whatsapp}>
            {(a) => (
              <input
                {...a}
                name="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 99999-9999"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
                onBlur={() => onBlur("whatsapp")}
              />
            )}
          </Field>
          <Field id="ctr-email" label="E-mail" optional error={errors.email}>
            {(a) => <input {...a} name="email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={() => onBlur("email")} />}
          </Field>
        </div>
        <fieldset className="plf-periods">
          <legend>
            Melhor horário para falarmos com você <small>(opcional)</small>
          </legend>
          <div>
            {periods.map((p) => (
              <label key={p.id} className={form.contactPeriod === p.id ? "is-on" : ""}>
                <input type="radio" name="contactPeriod" value={p.id} checked={form.contactPeriod === p.id} onChange={() => set("contactPeriod", p.id)} />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="ctr-notes" label="Ponto de referência ou observação" optional error={errors.notes} extraDescribedBy="ctr-notes-count">
          {(a) => (
            <>
              <textarea
                {...a}
                name="notes"
                rows={3}
                maxLength={NOTES_MAX}
                placeholder="Ex.: portão azul, ao lado da padaria"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                onBlur={() => onBlur("notes")}
              />
              <span id="ctr-notes-count" className="ctr-count">
                {form.notes.length}/{NOTES_MAX}
              </span>
            </>
          )}
        </Field>
        {/* Campo isca contra robôs: escondido de pessoas e de leitores de tela. */}
        <input className="plf-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => set("website", e.target.value)} />
        <div className="ctr-actions">
          <button type="button" className="ctr-back" onClick={() => goTo(1)}>
            <ArrowLeft size={16} aria-hidden="true" /> Voltar
          </button>
          <button type="submit" className="btn btn--primary">
            {returnToReview ? "Voltar à revisão" : "Revisar solicitação"} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  } else {
    const periodLabel = periods.find((p) => p.id === form.contactPeriod)?.label || "Qualquer horário";
    const rows = (list) =>
      list.map(([dt, dd]) => (
        <div key={dt}>
          <dt>{dt}</dt>
          <dd>{dd || "Não informado"}</dd>
        </div>
      ));
    cardBody = (
      <div className="ctr-panel" key="s3">
        <StepHead headingRef={headingRef} count="Etapa 3 de 3" title="Revise sua solicitação" lead="Confira se está tudo certo antes de enviar." />
        <section className="ctr-review" aria-labelledby="rv-plano">
          <div className="ctr-review-head">
            <h3 id="rv-plano">Plano</h3>
            <button type="button" className="ctr-edit" aria-label="Editar plano" disabled={sending} onClick={startChangePlan}>
              Editar
            </button>
          </div>
          <dl className="ctr-review-list">
            {rows([
              ["Plano", plan.name],
              ["Valor", `${plan.priceText}/mês`],
              ...(plan.note ? [["Condição", plan.note]] : []),
            ])}
          </dl>
        </section>
        <section className="ctr-review" aria-labelledby="rv-endereco">
          <div className="ctr-review-head">
            <h3 id="rv-endereco">Endereço de instalação</h3>
            <button type="button" className="ctr-edit" aria-label="Editar endereço" disabled={sending} onClick={() => {
                setReturnToReview(true);
                goTo(1, "cep");
              }}>
              Editar
            </button>
          </div>
          <dl className="ctr-review-list">
            {rows([
              ["Endereço", `${form.street.trim()}, ${form.number.trim()}`],
              ["Complemento", form.complement.trim()],
              ["Bairro", form.district.trim()],
              ["Cidade", form.uf.trim() ? `${form.city.trim()}/${form.uf.trim().toUpperCase()}` : form.city.trim()],
              ["CEP", maskCep(form.cep)],
            ])}
          </dl>
          <p className={`ctr-review-cov ${cityCovered ? "is-ok" : "is-warn"}`}>
            <MapPin size={15} aria-hidden="true" /> {cityCovered ? "Cidade atendida pela AcessaNet" : "Cidade ainda fora da nossa área de cobertura"}
          </p>
        </section>
        <section className="ctr-review" aria-labelledby="rv-contato">
          <div className="ctr-review-head">
            <h3 id="rv-contato">Contato</h3>
            <button type="button" className="ctr-edit" aria-label="Editar contato" disabled={sending} onClick={() => {
                setReturnToReview(true);
                goTo(2, "name");
              }}>
              Editar
            </button>
          </div>
          <dl className="ctr-review-list">
            {rows([
              ["Nome", form.name.trim()],
              ["WhatsApp", form.whatsapp],
              ["E-mail", form.email.trim()],
              ["Melhor horário", periodLabel],
              ...(form.notes.trim() ? [["Observação", form.notes.trim()]] : []),
            ])}
          </dl>
        </section>

        <section className="ctr-next-wrap" aria-labelledby="ctr-next-title">
          <h3 id="ctr-next-title">O que acontece depois</h3>
          <ol className="ctr-next">
            <li>Você recebe um número de protocolo assim que enviar.</li>
            <li>Nossa equipe comercial confirma a viabilidade técnica no seu endereço e as condições vigentes.</li>
            <li>A gente fala com você pelo WhatsApp para combinar a instalação.</li>
          </ol>
        </section>

        <div className="ctr-privacy">
          <span className="ctr-ico" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <p>
            Usamos seus dados apenas para analisar esta solicitação e falar com você sobre a contratação. Saiba como tratamos suas informações em{" "}
            <Link to="/lgpd" target="_blank" rel="noopener">
              Proteção de dados pessoais (LGPD)
            </Link>
            .
          </p>
        </div>
        <label className="ctr-check">
          <input type="checkbox" name="marketingOptIn" checked={form.marketingOptIn} onChange={(e) => set("marketingOptIn", e.target.checked)} />
          <span>
            Quero receber ofertas e novidades da AcessaNet. <small>(opcional)</small>
          </span>
        </label>
        <p className="pm-legal">{LEGAL}</p>

        {rateBlocked ? (
          <div className="ctr-notice is-warn ctr-notice--action" role="alert">
            <p>Muitas tentativas em pouco tempo. Tente novamente mais tarde ou fale com a gente pelo WhatsApp.</p>
            <a className="btn btn--ghost btn--sm" href={whatsHref} target="_blank" rel="noreferrer">
              <FaWhatsapp aria-hidden="true" /> Falar no WhatsApp
            </a>
          </div>
        ) : submitError === "rate" ? (
          <p className="ctr-notice is-warn" role="alert">
            Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo, ou{" "}
            <a href={whatsHref} target="_blank" rel="noreferrer">
              fale com a gente no WhatsApp
            </a>
            .
          </p>
        ) : (
          submitError && (
            <p className="plf-error" role="alert">
              {submitError}
            </p>
          )
        )}

        <div className="ctr-actions">
          <button type="button" className="ctr-back" disabled={sending} onClick={() => goTo(2)}>
            <ArrowLeft size={16} aria-hidden="true" /> Voltar
          </button>
          <button type="submit" className="btn btn--primary" disabled={sending || cooldown > 0 || rateBlocked}>
            {sending ? (
              <>
                <Loader2 size={18} className="plf-spin" aria-hidden="true" /> Enviando…
              </>
            ) : rateBlocked ? (
              "Envio indisponível no momento"
            ) : cooldown > 0 ? (
              `Tentar de novo em ${cooldown} s`
            ) : (
              <>
                <Send size={18} aria-hidden="true" /> Enviar solicitação de contratação
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Layout ---------- */

  let content;
  if (catalog.status === "loading") {
    content = <CatalogSkeleton visible={showSkel} />;
  } else if (catalog.status === "error") {
    content = (
      <div className="ctr-layout is-single">
        <div className="ctr-card">
          <div className="ctr-state" role="alert">
            <span className="ctr-ico is-danger" aria-hidden="true">
              <WifiOff size={20} />
            </span>
            <h2>Não foi possível carregar os planos</h2>
            <p>Verifique sua conexão e tente de novo. Se preferir, contrate pelo WhatsApp.</p>
            <div className="ctr-state-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setShowSkel(false);
                  setCatalog((c) => ({ ...c, status: "loading" }));
                  setReloadKey((k) => k + 1);
                }}
              >
                Tentar de novo
              </button>
              <a className="btn btn--ghost" href={whatsappLink("Olá! Quero contratar um plano da AcessaNet.")} target="_blank" rel="noreferrer">
                <FaWhatsapp aria-hidden="true" /> Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <div className={`ctr-layout ${plan ? "" : "is-single"}`}>
        <form ref={cardRef} className="ctr-card" noValidate onSubmit={onSubmit} aria-labelledby={done ? undefined : "ctr-step-title"} aria-busy={sending || undefined}>
          {!done && <Stepper step={showChoose ? 1 : step} />}
          {serverSummary && !done && (
            <div ref={summaryErrRef} className="ctr-summary-errors" role="alert" tabIndex={-1}>
              <p>Confira os campos destacados</p>
              <ul>
                {serverSummary.map(({ field, message }) => (
                  <li key={field}>
                    <a
                      href={`#ctr-${field}`}
                      onClick={(e) => {
                        e.preventDefault();
                        if (FIELD_STEP[field] === step && !showChoose) document.getElementById(`ctr-${field}`)?.focus();
                        else {
                          setChoosing(false);
                          goTo(FIELD_STEP[field], field);
                        }
                      }}
                    >
                      {FIELD_LABEL[field]}: {message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cardBody}
          {!done && (
            <a className="plf-whats" href={whatsHref} target="_blank" rel="noreferrer">
              <FaWhatsapp aria-hidden="true" /> Prefere falar agora? Chame no WhatsApp
            </a>
          )}
        </form>
        {plan && (
          <PlanSummary
            plan={plan}
            isMobile={isMobile}
            open={summaryOpen}
            onToggle={() => setSummaryOpen((o) => !o)}
            onChange={done || showChoose ? null : startChangePlan}
            changeDisabled={sending}
            address={summaryAddress}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <section className="page-hero" aria-labelledby="ctr-title">
        <div className="container">
          <span className="eyebrow">Contratação online</span>
          <h1 id="ctr-title">Solicitar contratação</h1>
          <p>Escolha o plano, informe o endereço de instalação e como falar com você. Leva poucos minutos.</p>
        </div>
      </section>
      <section className="section ctr" aria-label="Solicitação de contratação">
        <div className="container">{content}</div>
        <p className="sr-only" aria-live="polite">
          {liveMsg}
        </p>
      </section>
    </>
  );
}
