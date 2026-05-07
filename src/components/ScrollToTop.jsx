import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      let timeoutId;

      const scrollToHash = () => {
        const id = decodeURIComponent(location.hash.slice(1));
        const element = document.getElementById(id);

        if (!element) {
          return false;
        }

        if (window.lenis) {
          window.lenis.scrollTo(element);
        } else {
          element.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }

        return true;
      };

      const frameId = requestAnimationFrame(() => {
        if (!scrollToHash()) {
          timeoutId = window.setTimeout(scrollToHash, 120);
        }
      });

      return () => {
        cancelAnimationFrame(frameId);
        window.clearTimeout(timeoutId);
      };
    }

    if (window.lenis) {
      window.lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.search, location.hash]);

  return null;
}
