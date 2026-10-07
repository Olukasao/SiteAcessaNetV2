import { Headphones, MapPin, RadioTower, Wifi } from "lucide-react";

const stats = [
  {
    icon: Wifi,
    title: "Internet estável",
    text: "para toda a família",
  },
  {
    icon: RadioTower,
    title: "+Velocidade",
    text: "para streaming, jogos e trabalho",
  },
  {
    icon: Headphones,
    title: "Atendimento ágil",
    text: "suporte quando você precisar",
  },
  {
    icon: MapPin,
    title: "Cobertura local",
    text: "conectando sua região",
  },
];

export default function StatsBar() {
  return (
    <section className="stats-bar" aria-label="Diferenciais da Acessanet">
      <div className="stats-bar-inner">
        {stats.map(({ icon: Icon, title, text }) => (
          <article className="stat-item" key={title}>
            <span className="stat-icon">
              <Icon size={22} />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
