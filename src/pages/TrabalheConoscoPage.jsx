import { useEffect, useRef, useState } from "react";
import { Briefcase, CheckCircle2, FileText, Loader2, Rocket, Send, Upload, Users, X } from "lucide-react";
import { postJson } from "../lib/api";
import { useReveal } from "../hooks/useReveal";
import "../sections/sections.css";
import "./institucional.css";

// Conteúdo copiado da página /trabalhe-conosco da produção (branch
// site-antigo). O currículo vai para o backend da AcessaNet e aparece no
// painel admin, aba "Currículos" (/admin/curriculos).
const areas = ["Suporte Técnico", "Instalador", "Atendimento", "Administrativo", "Outra"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = [".pdf", ".doc", ".docx"];

const perks = [
  { icon: Rocket, title: "Crescimento profissional", text: "Ambiente focado em evolução e aprendizado constante." },
  { icon: Users, title: "Equipe unida", text: "Trabalho colaborativo e valorização das pessoas." },
  { icon: Briefcase, title: "Oportunidades", text: "Áreas técnicas, atendimento e administrativas." },
];

const emptyForm = { name: "", email: "", phone: "", area: "", message: "", website: "" };

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileProblem(file) {
  const name = file.name.toLowerCase();
  if (!ACCEPTED.some((ext) => name.endsWith(ext))) return "Envie o currículo em PDF, DOC ou DOCX.";
  if (file.size > MAX_FILE_BYTES) return "O arquivo deve ter no máximo 5 MB.";
  return "";
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function TrabalheConoscoPage() {
  const ref = useRef(null);
  const fileInput = useRef(null);
  useReveal(ref);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Trabalhe Conosco | AcessaNet";
  }, []);

  const update = (field) => (e) => {
    setError("");
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const onPickFile = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const problem = fileProblem(picked);
    setError(problem);
    setFile(problem ? null : picked);
    if (problem) e.target.value = "";
  };

  const clearFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Anexe o seu currículo (PDF, DOC ou DOCX).");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      await postJson("/api/careers/applications", {
        name: form.name,
        email: form.email,
        phone: form.phone,
        area: form.area || null,
        message: form.message || null,
        website: form.website || null,
        file: { name: file.name, data: await readAsBase64(file) },
      });
      setStatus("sent");
      setForm(emptyForm);
      clearFile();
    } catch (err) {
      setStatus("idle");
      setError(err.message || "Não foi possível enviar agora. Tente novamente em instantes.");
    }
  };

  return (
    <>
      <section className="page-hero" aria-labelledby="tc-title">
        <div className="container">
          <span className="eyebrow">Carreiras</span>
          <h1 id="tc-title">Trabalhe conosco</h1>
          <p>Faça parte da equipe que conecta pessoas todos os dias.</p>
        </div>
      </section>

      <section ref={ref} className="section inst" aria-label="Vagas e currículo">
        <div className="container">
          <ul className="inst-perks">
            {perks.map(({ icon: Icon, title, text }) => (
              <li key={title} className="inst-card" data-reveal>
                <span className="inst-ico" aria-hidden="true"><Icon size={22} /></span>
                <h2>{title}</h2>
                <p>{text}</p>
              </li>
            ))}
          </ul>

          <div className="inst-apply" data-reveal>
            <div className="inst-apply-copy">
              <span className="eyebrow">Envie seu currículo</span>
              <h2>Quer crescer com a gente?</h2>
              <p>Preencha seus dados, escolha a área de interesse e anexe o seu currículo. Nossa equipe entra em contato.</p>
            </div>

            {status === "sent" ? (
              <div className="inst-form inst-form-done" role="status">
                <CheckCircle2 size={44} aria-hidden="true" />
                <h3>Currículo enviado!</h3>
                <p>Recebemos o seu currículo. Se o seu perfil combinar com uma vaga, entraremos em contato.</p>
                <button type="button" className="btn btn--ghost" onClick={() => setStatus("idle")}>
                  Enviar outro currículo
                </button>
              </div>
            ) : (
              <form className="inst-form" onSubmit={onSubmit} noValidate={false}>
                <label>
                  <span>Nome completo</span>
                  <input name="name" autoComplete="name" required minLength={3} value={form.name} onChange={update("name")} />
                </label>
                <div className="inst-form-row">
                  <label>
                    <span>E-mail</span>
                    <input name="email" type="email" autoComplete="email" required value={form.email} onChange={update("email")} />
                  </label>
                  <label>
                    <span>Telefone</span>
                    <input name="phone" type="tel" autoComplete="tel" required minLength={8} value={form.phone} onChange={update("phone")} />
                  </label>
                </div>
                <label>
                  <span>Área de interesse</span>
                  <select name="area" value={form.area} onChange={update("area")}>
                    <option value="">Selecione</option>
                    {areas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Fale um pouco sobre você</span>
                  <textarea name="message" rows={4} maxLength={3000} value={form.message} onChange={update("message")} />
                </label>

                {/* Campo isca contra robôs: escondido de pessoas e de leitores de tela. */}
                <input
                  className="inst-hp"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={form.website}
                  onChange={update("website")}
                />

                <div className="inst-file">
                  <span>Currículo</span>
                  {file ? (
                    <div className="inst-file-chip">
                      <FileText size={20} aria-hidden="true" />
                      <span>
                        <strong>{file.name}</strong>
                        <small>{formatSize(file.size)}</small>
                      </span>
                      <button type="button" onClick={clearFile} aria-label="Remover arquivo">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <label className="inst-file-drop">
                      <Upload size={20} aria-hidden="true" />
                      <span>
                        <strong>Anexar arquivo</strong>
                        <small>PDF, DOC ou DOCX, até 5 MB</small>
                      </span>
                      <input ref={fileInput} type="file" accept={ACCEPTED.join(",")} onChange={onPickFile} />
                    </label>
                  )}
                </div>

                {error && <p className="inst-form-error" role="alert">{error}</p>}

                <button type="submit" className="btn btn--primary btn--block" disabled={status === "sending"}>
                  {status === "sending" ? (
                    <><Loader2 size={18} className="inst-spin" aria-hidden="true" /> Enviando…</>
                  ) : (
                    <><Send size={18} aria-hidden="true" /> Enviar currículo</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
