import { useEffect } from "react";

// Substitui o <Helmet> da Central antiga: título da aba + noindex enquanto a
// página estiver montada (a Central nunca deve ser indexada).
export default function PageMeta({ title }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let robots = document.querySelector('meta[name="robots"]');
    const created = !robots;
    const previousContent = robots?.getAttribute("content");
    if (created) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex,nofollow");

    return () => {
      document.title = previousTitle;
      if (created) robots.remove();
      else robots.setAttribute("content", previousContent ?? "");
    };
  }, [title]);

  return null;
}
