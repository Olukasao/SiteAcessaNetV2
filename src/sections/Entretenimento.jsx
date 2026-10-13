import { useRef } from "react";
import { services, temSaudePlans } from "../data/site";
import { useReveal } from "../hooks/useReveal";
import "./sections.css";

const items = [
  { key: "globoplay", where: "Nos planos 700 e 800 Mega", text: "Globoplay no padrão com anúncios, incluso na sua assinatura." },
  { key: "watch", where: "No plano 800 Mega", text: "Filmes, séries e canais ao vivo direto na sua internet, com Premiere." },
  { key: "livros", where: "Nos planos 700 e 800 Mega", text: "Uma nova forma de ler livros digitais e explorar conteúdos exclusivos para toda a família." },
  {
    key: "temsaude",
    where: "No 800 Mega ou avulso",
    text: `Consultas, exames e descontos em farmácias. Avulso a partir de ${temSaudePlans[0].priceText}/mês.`,
  },
];

export default function Entretenimento() {
  const ref = useRef(null);
  useReveal(ref);
  return (
    <section ref={ref} className="section section--dark ent" aria-labelledby="ent-title">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">Benefícios e entretenimento</span>
          <h2 id="ent-title">Mais do que internet. Tudo o que você curte, incluso.</h2>
        </div>
        <div className="ent-grid">
          {items.map(({ key, where, text }, i) => {
            const s = services[key];
            return (
              <article key={key} className={`ent-card ent-card--${i}`} data-reveal>
                <div className={`ent-logo ${s.dark ? "is-dark" : ""}`}>
                  <img src={s.logo} alt={s.name} loading="lazy" />
                </div>
                <span className="ent-where">{where}</span>
                <h3>{s.name}</h3>
                <p>{text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
