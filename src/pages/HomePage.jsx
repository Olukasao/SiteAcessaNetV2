import { Helmet } from "react-helmet";
import AppProvedor from "../components/AppProvedor";
import BannerCarousel from "../components/BannerCarousel";
import Planos from "../components/Planos";
import PlanosEspeciais from "../components/PlanosEspeciais";
import WatchTV from "../components/WatchTV";
import TemSaude from "../components/TemSaude";
export default function HomePage() {
    return (
        <>
            <BannerCarousel />
            <Planos />
            <PlanosEspeciais />
            <WatchTV />
            <TemSaude />
            <AppProvedor />

        </>
    )
}