import "../styles/components-styles/watchTV.css";
import { useRef, useEffect, useState } from "react";
import watch from "../assets/watchTV/watch.png";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const filmesModules = import.meta.glob(
    "../assets/watchTV/filmes/*.{png,jpg,jpeg,webp}"
);

const canaisModules = import.meta.glob(
    "../assets/watchTV/canais/*.{png,jpg,jpeg,webp}"
);


const loadImages = async (modules) => {
    const entries = Object.entries(modules);

    const imgs = await Promise.all(
        entries.map(async ([path, loader]) => {
            const mod = await loader();
            return { path, src: mod.default };
        })
    );

    return imgs
        .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
        .map((item) => item.src);
};

function useNearViewport(rootMargin = "700px") {
    const ref = useRef(null);
    const [isNearViewport, setIsNearViewport] = useState(false);

    useEffect(() => {
        if (isNearViewport) return undefined;

        const element = ref.current;
        if (!element) return undefined;

        if (!("IntersectionObserver" in window)) {
            const timeoutId = window.setTimeout(() => setIsNearViewport(true), 0);
            return () => window.clearTimeout(timeoutId);
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsNearViewport(true);
                    observer.disconnect();
                }
            },
            { rootMargin }
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, [isNearViewport, rootMargin]);

    return [ref, isNearViewport];
}

export default function WatchTV() {
    const [sectionRef, shouldLoadAssets] = useNearViewport();
    const movieRef = useRef(null);
    const channelRef = useRef(null);

    const [filmesImgs, setFilmesImgs] = useState([]);
    const [canaisImgs, setCanaisImgs] = useState([]);

    useEffect(() => {
        if (!shouldLoadAssets) return undefined;

        let isMounted = true;

        async function fetchData() {
            const filmesData = await loadImages(filmesModules);
            const canaisData = await loadImages(canaisModules);

            if (isMounted) {
                setFilmesImgs(filmesData);
                setCanaisImgs(canaisData);
            }
        }

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [shouldLoadAssets]);


    const scroll = (ref, dir) => {
        if (!ref.current) return;

        ref.current.scrollBy({
            left: dir === "left" ? -320 : 320,
            behavior: "smooth",
        });
    };

    return (
        <section className="watchtv" ref={sectionRef}>
            <div className="watchtv-container">

                {/* HERO */}
                <div className="watchtv-hero">
                    <div className="watchtv-info">
                        <span className="watchtv-badge">INCLUSO NOS PLANOS</span>

                        <h2>Watch TV</h2>

                        <p>
                            Filmes, séries e canais ao vivo direto na sua internet.
                            Mais entretenimento com qualidade HD e estabilidade
                            garantida pela nossa rede.
                        </p>

                        <a href="/planos" className="watchtv-btn">
                            Ver planos com Watch TV
                        </a>
                    </div>

                    <div className="watchtv-mockup">
                        <img
                            src={watch}
                            alt="Watch TV App"
                            loading="lazy"
                            decoding="async"
                        />
                    </div>
                </div>

                {/* FILMES */}
                <div className="section-header">
                    <h3>Filmes e Séries</h3>

                    <div className="nav">
                        <button onClick={() => scroll(movieRef, "left")}>
                            <FaChevronLeft />
                        </button>
                        <button onClick={() => scroll(movieRef, "right")}>
                            <FaChevronRight />
                        </button>
                    </div>
                </div>

                <div className="carousel-watch carousel-watch--movies" ref={movieRef}>
                    {!shouldLoadAssets ? (
                        Array.from({ length: 5 }).map((_, index) => (
                            <div className="movie-card movie-card--placeholder" key={index} aria-hidden="true" />
                        ))
                    ) : filmesImgs.length === 0 ? (
                        <p>Carregando filmes...</p>
                    ) : (
                        filmesImgs.map((img) => (
                            <div className="movie-card" key={img}>
                                <img
                                    src={img}
                                    className="imgs-watch"
                                    width="180"
                                    height="260"
                                    loading="lazy"
                                    decoding="async"
                                    alt="Filme"
                                />
                            </div>
                        ))
                    )}
                </div>

                {/* CANAIS */}
                <div className="section-header">
                    <h3>Canais ao Vivo</h3>

                    <div className="nav">
                        <button onClick={() => scroll(channelRef, "left")}>
                            <FaChevronLeft />
                        </button>
                        <button onClick={() => scroll(channelRef, "right")}>
                            <FaChevronRight />
                        </button>
                    </div>
                </div>

                <div className="carousel-watch carousel-watch--channels" ref={channelRef}>
                    {!shouldLoadAssets ? (
                        Array.from({ length: 5 }).map((_, index) => (
                            <div className="channel-card channel-card--placeholder" key={index} aria-hidden="true" />
                        ))
                    ) : canaisImgs.length === 0 ? (
                        <p>Carregando canais...</p>
                    ) : (
                        canaisImgs.map((img) => (
                            <div className="channel-card" key={img}>
                                <img
                                    src={img}
                                    width="90"
                                    height="60"
                                    loading="lazy"
                                    decoding="async"
                                    alt="Canal TV"
                                />
                            </div>
                        ))
                    )}
                </div>

            </div>
        </section>
    );
}
