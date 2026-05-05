import "./temaSection.css"
import mae from "../../assets/banners/banner-maes.png"

const temas = {
    maes: {
        titulo: "Mês das Mães 💖",
        desc: "Conecte quem sempre esteve ao seu lado com mais velocidade e estabilidade.",
        imagem: mae,
        combos: [
            { nome: "400 Mega", preco: "74,99", destaque: false },
            { nome: "700 Mega", preco: "94,99", destaque: true },
            { nome: "700 Mega + TV", preco: "149,99", destaque: false }
        ]
    }
}

export default function TemaSection({ tema = "maes" }) {
    const data = temas[tema]

    
    return (
        <section className="tema-section">
            <div className="tema-container">

                <div className="tema-content">

                    {/* TEXTO */}
                    <div className="tema-texto">
                        <span className="tema-tag">💖 Oferta especial</span>

                        <h2>{data.titulo}</h2>
                        <p>{data.desc}</p>

                        <div className="tema-combos">
                            {data.combos.map((combo, i) => (
                                <div
                                    key={i}
                                    className={`combo-card ${combo.destaque ? "highlight" : ""}`}
                                >
                                    {combo.destaque && (
                                        <span className="combo-badge">
                                            MAIS VENDIDO
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
                                        rel="noreferrer"
                                        className="btn-combo"
                                    >
                                        Contratar
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* IMAGEM */}
                    <div className={`tema-imagem-${tema}`}>
                        <img src={data.imagem} alt={data.titulo} />
                    </div>

                </div>
            </div>
        </section>
    )
}