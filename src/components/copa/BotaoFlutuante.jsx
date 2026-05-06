import "./BotaoFlutuante.css"

export default function BotaoFlutuante() {

    const planos = {
        "700MEGA_COMBO": {
            velocidade: "700",
            preco: "194",
            precoCentavos: "99",
            beneficios: {

            }
        },
        "400MEGA": {
            velocidade: "400",
        }


    }

    return (
        <div className="container-button">
            <div className="button">

                <div className="">
                    <span>{planos["700MEGA_COMBO"].velocidade}</span>
                    <span>MEGA</span>
                </div>
                <div>
                    Watch Tv
                </div>
                <div className="container-preco">
                    <div>Por apenas</div>
                    <div>
                        <span>R$</span>
                        <span>{planos["700MEGA_COMBO"].preco}</span>
                    </div>
                    <div>
                        <div>{planos["700MEGA_COMBO"].precoCentavos}</div>
                        <div>/mês</div>
                    </div>
                </div>
            </div>
        </div>
    )
}