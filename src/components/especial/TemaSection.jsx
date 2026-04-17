import "./temaSection.css"

const temas = {
    pascoa: {
        titulo: "Páscoa Premiada 🐰",
        desc: "Ofertas especiais por tempo limitado.",
        cor: "#8b5cf6",
        bg: "/banners/pascoa.jpg",
        combos: [
            { nome: "400 Mega", preco: "79,99", destaque: false },
            { nome: "700 Mega", preco: "99,90", destaque: true },
            { nome: "700 Mega + TV", preco: "149,90", destaque: false }
        ]
    },

    maes: {
        titulo: "Especial Dia das Mães 💖",
        desc: "Ofertas especiais para conectar você a quem mais importa",
        cor: "#ce0a0a",
        bg: "/banners/maes.jpg",
        combos: [
            { nome: "400 Mega", preco: "69,99", destaque: false },
            { nome: "700 Mega", preco: "89,90", destaque: true },
            { nome: "700 Mega + TV", preco: "149,90", destaque: false }

        ]
    }
}

export default function TemaSection({ tema = "maes" }) {
    const data = temas[tema]

    return (
        <section
            className="tema-section"
            style={{
                "--cor-tema": data.cor,
                "--bg-imagem": `url(${data.bg})`
            }}
        >
            <div className="tema-overlay">

                <div className="tema-container">

                    {/* HEADER */}
                    <div className="tema-header">
                        <h2>{data.titulo}</h2>
                        <p>{data.desc}</p>
                    </div>

                    {/* COMBOS */}
                    <div className="tema-combos">
                        {data.combos.map((combo, i) => (
                            <div
                                key={i}
                                className={`combo-card ${combo.destaque ? "highlight" : ""}`}
                            >
                                {combo.destaque && (
                                    <span className="combo-badge">
                                        🔥 MAIS VENDIDO
                                    </span>
                                )}

                                <h3>{combo.nome}</h3>

                                <div className="combo-preco">
                                    <span>R$</span>
                                    <strong>{combo.preco}</strong>
                                    <small>/mês</small>
                                </div>

                                <a
                                    href={`https://wa.me/5508004445799?text=Quero o plano ${combo.nome}`}
                                    target="_blank"
                                    className="btn-combo"
                                >
                                    Contratar
                                </a>
                            </div>
                        ))}
                    </div>

                </div>

            </div>
        </section>
    )
}