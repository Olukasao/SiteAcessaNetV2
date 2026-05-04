import maes from "../../assets/banners/Maes.png"
import "./heroMaes.css"

export default function HeroMaes() {
    return (
        <section className="hero-maes">
            <img src={maes} alt="Mês das Mães" width={200} />
        </section>
    )
}