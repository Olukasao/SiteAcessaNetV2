import { useState, useEffect } from "react";
import "../styles/components-styles/bannerCarousel.css";
import "../components/copa/BotaoCopa.css";
import "../components/copa/Assine.css";

import temsaude from "../assets/banners/temsaude.jpeg";
import testecopa from "../assets/copa/testecopa.png";
import canarinho from "../assets/copa/canarinho.png";

import { Heart } from "lucide-react";

import FloatingButton from "../components/maes/FloatingButton";
import BotaoCopa from "../components/copa/BotaoCopa";
import BotaoAssine from "../components/copa/Assine";

const banners = [

  {
    title: "",
    subtitle: "",
    icon: Heart,
    image: testecopa,
    width: "50vw",
  },

  {
    title: "",
    subtitle: "",
    icon: Heart,
    image: temsaude,
  },

  {
    title: "",
    subtitle: "",
    icon: Heart,
    image: canarinho,
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
        return (
          <div
            key={index}
            className={`slide ${index === current ? "active" : ""}`}
          >
            {index === 3 && <FloatingButton />}

            {index === 2 && (
              <div className="botao-assine-wrapper">
                <BotaoAssine />
              </div>
            )}

            {index === 0 && (
              <div className="botao-copa-wrapper">
                <BotaoCopa />
              </div>
            )}
            

            <img
              src={banner.image}
              alt=""
              style={{
                width: "100%",
                height: banner.height || "100%",
              }}
            />
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
