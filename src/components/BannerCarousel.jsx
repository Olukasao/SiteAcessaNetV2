import { useState, useEffect } from "react";
import "../styles/components-styles/bannerCarousel.css";
import b1 from "../assets/pascoa/1.png"

const banners = [
  {
    title: "Promoção de Páscoa",
    subtitle: "Alta velocidade e estabilidade para sua casa",
      image: b1,
  },

  {
    title: "700 MEGA + Watch TV",
    subtitle: "Planos com ofertas exclusivas",
    image: "/banners/banner3.jpg",
  },
];

export default function BannerCarousel() {
  const [current, setCurrent] = useState(0);

  // troca automática
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

      {banners.map((banner, index) => (
        <div
          key={index}
          className={`slide ${
            index === current ? "active" : ""
          }`}
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
      ))}

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