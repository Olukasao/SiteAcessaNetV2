import { useEffect, useState } from "react";
import "../styles/components-styles/cursor.css";

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const moveCursor = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const addHover = () => setHover(true);
    const removeHover = () => setHover(false);

    window.addEventListener("mousemove", moveCursor);

    const links = document.querySelectorAll(
      "a, button, .plano-card, .movie-card"
    );

    links.forEach((el) => {
      el.addEventListener("mouseenter", addHover);
      el.addEventListener("mouseleave", removeHover);
    });

    return () => {
      window.removeEventListener("mousemove", moveCursor);
    };
  }, []);

  return (
    <div
      className={`cursor ${hover ? "cursor-hover" : ""}`}
      style={{
        left: position.x,
        top: position.y,
      }}
    />
  );
}