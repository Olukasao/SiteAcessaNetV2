import { useEffect, useRef } from "react";
import { Check, Database, Mail, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { company } from "../data/site";
import { useReveal } from "../hooks/useReveal";
import "../sections/sections.css";
import "./institucional.css";

// Conteúdo copiado da página /lgpd da produção (branch site-antigo,
// src/pages/LGPD.jsx) -- só a apresentação é nova.
const privacyEmail = "contato@acessanet.com";

const sections = [
  {
    id: "dados-coletados",
    icon: Database,
    title: "Dados que coletamos",
    intro: "Coletamos apenas os dados essenciais para a prestação de nossos serviços, como:",
    items: [
      "Nome completo",
      "CPF e RG",
      "Endereço completo",
      "Telefone e e-mail",
      "Dados bancários (quando necessário para cobrança)",
    ],
  },
  {
    id: "uso-dos-dados",
    icon: Sparkles,
    title: "Como utilizamos seus dados",
    intro: "Essas informações são utilizadas exclusivamente para:",
    items: [
      "Instalação e manutenção dos serviços contratados",
      "Emissão de boletos e faturas",
      "Atendimento e suporte técnico",
      "Envio de comunicações sobre os serviços (vencimentos, promoções e avisos)",
    ],
  },
  {
    id: "seguranca",
    icon: ShieldCheck,
    title: "Segurança das informações",
    intro:
      "Todos os dados são armazenados com segurança, com acesso restrito a profissionais autorizados e seguindo rígidos padrões de confidencialidade.",
  },
  {
    id: "seus-direitos",
    icon: UserCheck,
    title: "Seus direitos",
    intro: "Você tem o direito de:",
    items: [
      "Acessar seus dados",
      "Corrigir informações incompletas ou desatualizadas",
      "Solicitar a exclusão de dados (quando permitido por lei)",
      "Solicitar a portabilidade ou limitação do uso de seus dados",
    ],
  },
];

export default function LgpdPage() {
  const ref = useRef(null);
  useReveal(ref);
  useEffect(() => {
    document.title = "LGPD e Privacidade | AcessaNet";
  }, []);

  return (
    <>
      <section className="page-hero" aria-labelledby="lgpd-title">
        <div className="container">
          <span className="eyebrow">Privacidade</span>
          <h1 id="lgpd-title">Proteção de dados pessoais</h1>
          <p>
            A {company.name} se compromete com a proteção dos seus dados pessoais, em total conformidade com a
            Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD).
          </p>
        </div>
      </section>

      <section ref={ref} className="section inst" aria-label="Política de privacidade">
        <div className="container inst-layout">
          <nav className="inst-index" aria-label="Nesta página">
            <span>Nesta página</span>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>{s.title}</a>
            ))}
            <a href="#contato-lgpd">Contato</a>
          </nav>

          <div className="inst-stack">
            {sections.map(({ id, icon: Icon, title, intro, items }) => (
              <article key={id} id={id} className="inst-card" data-reveal>
                <header className="inst-card-head">
                  <span className="inst-ico" aria-hidden="true"><Icon size={22} /></span>
                  <h2>{title}</h2>
                </header>
                <p>{intro}</p>
                {items && (
                  <ul className="inst-list">
                    {items.map((item) => (
                      <li key={item}>
                        <Check size={16} aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}

            <div id="contato-lgpd" className="inst-cta" data-reveal>
              <div>
                <h2>Contato</h2>
                <p>Para mais informações ou para exercer seus direitos, entre em contato pelo e-mail:</p>
              </div>
              <a className="btn btn--primary" href={`mailto:${privacyEmail}`}>
                <Mail size={18} aria-hidden="true" /> {privacyEmail}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
