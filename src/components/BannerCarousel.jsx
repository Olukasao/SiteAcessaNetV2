import { useState, useEffect } from "react";
import "../styles/components-styles/bannerCarousel.css";
import b1 from "../assets/pascoa/1.png"
import mae from "../assets/banners/Maes.png"
import temSaude from "../assets/banners/TemSaude.png"
import { Heart, Wifi, Tv, BookOpen } from "lucide-react";

const banners = [
  {
    title: "Promoção Mês das Mães",
    subtitle: "Ofertas especiais para conectar você a quem mais importa",
    icon: Heart,
    image: mae,
  },
  {
    title: "700 MEGA + Watch TV",
    subtitle: "Internet ultra rápida + TV inclusa sem custo extra",
    icon: Tv,
    image: "/banners/banner3.jpg",
  },
  {
    title: "App de Leitura Graviola",
    subtitle: "Milhares de livros digitais inclusos no seu plano",
    icon: BookOpen,
    image: "/banners/banner3.jpg",
  },
  {
    title: "TemSaude",
    subtitle: "Adicione consultas médicas e telemedicina por um pequeno valor mensal",
    icon: BookOpen,
    image: temSaude,
  }
];

export default function BannerCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const next = () =>
    setCurrent((current + 1) % banners.length);

  const prev = () =>
    setCurrent(
      (current - 1 + banners.length) % banners.length
    );

  return (
    <section className="carousel">

      {banners.map((banner, index) => {
        const Icon = banner.icon;

        return (
          <div
            key={index}
            className={`slide ${index === current ? "active" : ""}`}
            style={{ backgroundImage: `url(${banner.image})` }}
          >
            <div className="overlay">
              <h1>{banner.title}</h1>
              <p>{banner.subtitle}</p>

              <a href="/planos" className="carousel-btn">
                Ver Planos
              </a>

            </div>
          </div>
        );
      })}

      {/* SETAS */}
      <button className="arrow left" onClick={prev}>
        ❮
      </button>

      <button className="arrow right" onClick={next}>
        ❯
      </button>

      {/* INDICADORES */}
      <div className="dots">
        {banners.map((_, i) => (
          <span
            key={i}
            className={i === current ? "dot active" : "dot"}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>

    </section>
  );
}