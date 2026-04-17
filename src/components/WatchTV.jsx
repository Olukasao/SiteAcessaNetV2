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
    const loaders = Object.values(modules);

    const imgs = await Promise.all(
        loaders.map(async (loader) => {
            const mod = await loader();
            return mod.default;
        })
    );

    return imgs.sort();
};

export default function WatchTV() {
    const movieRef = useRef(null);
    const channelRef = useRef(null);

    const [filmesImgs, setFilmesImgs] = useState([]);
    const [canaisImgs, setCanaisImgs] = useState([]);

    useEffect(() => {
        async function fetchData() {
            const filmesData = await loadImages(filmesModules);
            const canaisData = await loadImages(canaisModules);

            setFilmesImgs(filmesData);
            setCanaisImgs(canaisData);
        }

        fetchData();
    }, []);


    const scroll = (ref, dir) => {
        if (!ref.current) return;

        ref.current.scrollBy({
            left: dir === "left" ? -320 : 320,
            behavior: "smooth",
        });
    };

    return (
        <section className="watchtv">
            <div className="watchtv-container">

                {/* HERO */}
                <div className="watchtv-hero">
                    <div className="watchtv-info">
                        <span className="badge">INCLUSO NOS PLANOS</span>

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

                <div className="carousel-watch" ref={movieRef}>
                    {filmesImgs.length === 0 ? (
                        <p>Carregando filmes...</p>
                    ) : (
                        filmesImgs.map((img, i) => (
                            <div className="movie-card" key={img}>
                                <img
                                    src={img}
                                    className="imgs-watch"
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

                <div className="carousel-watch" ref={channelRef}>
                    {canaisImgs.length === 0 ? (
                        <p>Carregando canais...</p>
                    ) : (
                        canaisImgs.map((img, i) => (
                            <div className="channel-card" key={img}>
                                <img
                                    src={img}
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