import "../styles/components-styles/temSaude.css"
import temSaude from "../assets/temSaude.png"

export default function TemSaude() {
    return (
        <>
            {/* ===== SEÇÃO INFO ===== */}
            <section className="temsaude-info">
                <div className="temsaude-info-wrap">

                    <div className="temsaude-info-left">
                        <h2>Tem Saúde</h2>

                        <p>
                            Consultas, exames e descontos em farmácias direto na sua internet.
                            Mais cuidado com a saúde da sua família com preço acessível e sem burocracia.
                        </p>

                        <a href="/planos" className="btn-temsaude">
                            Ver planos do Tem Saúde
                        </a>
                    </div>

                    <div className="temsaude-info-right">
                        <div className="temsaude-box">
                            <img src={temSaude} alt="Tem Saúde" />
                        </div>
                    </div>

                </div>
            </section>

            {/* ===== SEÇÃO PLANOS ===== */}
            <section className="temsaude-plans-section">
                <div className="temsaude-plans-wrap">

                    <h2>Escolha seu plano</h2>

                    <div className="temsaude-plans">

                        <div className="temsaude-plan">
                            <h3>Individual</h3>
                            <p className="price">R$ 10,99</p>

                            <ul>
                                <li>Consultas com desconto</li>
                                <li>Exames mais baratos</li>
                                <li>Farmácias conveniadas</li>
                            </ul>

                            <button
                                onClick={() =>
                                    window.open(
                                        "https://api.whatsapp.com/send/?phone=5508004445799&text=Quero%20contratar%20o%20plano%20do%20TemSa%C3%BAde",
                                        "_blank"
                                    )
                                }
                            >
                                Contratar
                            </button>
                        </div>

                        <div className="temsaude-plan highlight">
                            <span className="badge-t">Mais vantajoso</span>

                            <h3>Familiar</h3>
                            <p className="price">R$ 19,99</p>

                            <ul>
                                <li>Titular + 3 dependentes</li>
                                <li>Todos os benefícios inclusos</li>
                                <li>Melhor custo-benefício</li>
                            </ul>

                            <button
                                onClick={() =>
                                    window.open(
                                        "https://api.whatsapp.com/send/?phone=5508004445799&text=Quero%20contratar%20o%20plano%20do%20TemSa%C3%BAde",
                                        "_blank"
                                    )
                                }
                            >
                                Contratar
                            </button>
                        </div>

                    </div>

                </div>
            </section>
        </>
    )
}