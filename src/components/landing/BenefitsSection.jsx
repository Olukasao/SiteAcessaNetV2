import { HeartHandshake, MonitorPlay, Router, Zap } from "lucide-react";

const benefits = [
  {
    icon: Zap,
    title: "Navegação rápida",
    text: "Planos pensados para manter sua rotina digital sempre fluida.",
  },
  {
    icon: MonitorPlay,
    title: "Streaming sem travamentos",
    text: "Mais estabilidade para filmes, séries, lives e conteúdos em alta definição.",
  },
  {
    icon: Router,
    title: "Wi-Fi para toda a casa",
    text: "Conexão preparada para celulares, notebooks, TVs e dispositivos inteligentes.",
  },
  {
    icon: HeartHandshake,
    title: "Suporte humanizado",
    text: "Atendimento próximo, ágil e focado em resolver o que você precisa.",
  },
];

export default function BenefitsSection() {
  return (
    <section id="beneficios" className="benefits-section">
      <div className="benefits-inner">
        <div className="benefits-heading">
          <span>Benefícios</span>
          <h2>Por que escolher a Acessanet?</h2>
          <p>
            Tecnologia, estabilidade e atendimento local em uma experiência
            de internet feita para residências conectadas.
          </p>
        </div>

        <div className="benefits-grid">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article className="benefit-card" key={title}>
              <span>
                <Icon size={24} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
