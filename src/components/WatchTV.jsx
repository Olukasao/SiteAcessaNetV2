import "../styles/components-styles/watchTV.css";
import { useRef } from "react";
import watch from "../assets/watchTV/watch.png"
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const filmes = Object.values(
    import.meta.glob(
        "../assets/watchTV/filmes/*.{png,jpg,jpeg,webp}",
        { eager: true }
    )
)
    .map((file) => file.default)
    .sort();


const canais = Object.values(
    import.meta.glob(
        "../assets/watchTV/canais/*.{png,jpg,jpeg,webp}",
        { eager: true }
    )
).map((file) => file.default).sort();


export default function WatchTV() {
    const movieRef = useRef(null);
    const channelRef = useRef(null);

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

                {/* HERO ISP */}
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
                        {/* coloque a imagem em public/watchtv/mockup-tv.png */}
                        <img src={watch} alt="Watch TV App" />
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
                    {filmes.map((img, i) => (
                        <div className="movie-card" key={i}>
                            <img src={img} className="imgs-watch" alt="Filme" />

                        </div>
                    ))}
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
                    {canais.map((img, i) => (
                        <div className="channel-card" key={i}>
                            <img src={img} alt="Canal TV" />
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
}