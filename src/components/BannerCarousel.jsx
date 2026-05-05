import { useState, useEffect } from "react";
import "../styles/components-styles/bannerCarousel.css";
import mae from "../assets/banners/banner-maes.png"
import temsaude from "../assets/banners/temsaude.jpeg"
import { Heart, Wifi, Tv, BookOpen } from "lucide-react"; 

const banners = [
  {
    title: "",
    subtitle: "",
    icon: Heart,
    image: mae,
  },
 
   {
    title: "",
    subtitle: "",
    icon: Heart,
    image: temsaude,
  },
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