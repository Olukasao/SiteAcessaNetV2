import { useState, useEffect } from "react";
import "../styles/components-styles/bannerCarousel.css";

import temsaude from "../assets/banners/temsaude.jpeg";

const banners = [
  {
    title: "",
    subtitle: "",
    image: temsaude,
  },
];

export default function BannerCarousel() {
  const [current, setCurrent] = useState(0);
  const hasMultipleBanners = banners.length > 1;

  useEffect(() => {
    if (!hasMultipleBanners) return undefined;

    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 8500);

    return () => clearInterval(interval);
  }, [hasMultipleBanners]);

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
            <img
              src={banner.image}
              alt=""
              width="1600"
              height="800"
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              style={{
                width: "100%",
                height: banner.height || "100%",
                objectPosition: banner.objectPosition || "center",
              }}
            />
          </div>
        );
      })}

      {/* SETAS */}
      {hasMultipleBanners && (
        <>
          <button className="arrow left" onClick={prev}>
            ❮
          </button>

          <button className="arrow right" onClick={next}>
            ❯
          </button>
        </>
      )}

      {/* INDICADORES */}
      {hasMultipleBanners && (
        <div className="dots">
          {banners.map((_, i) => (
            <span
              key={i}
              className={i === current ? "dot active" : "dot"}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>
      )}

    </section>
  );
}
