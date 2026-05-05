import { Helmet } from "react-helmet-async";
import AppProvedor from "../components/AppProvedor";
import BannerCarousel from "../components/BannerCarousel";
import Planos from "../components/Planos";
import PlanosEspeciais from "../components/PlanosEspeciais";
import WatchTV from "../components/WatchTV";
import TemSaude from "../components/TemSaude";
import Graviola from "../components/Graviola";

export default function HomePage() {
    return (
        <>

            <Helmet>
                <title>Internet Fibra em Franco da Rocha | Acessanet Telecom</title>

                <meta
                    name="description"
                    content="Internet fibra óptica rápida e estável em Franco da Rocha e região. Confira os planos da Acessanet Telecom e contrate agora."
                />

                {/* SEO básico */}
                <meta
                    name="keywords"
                    content="internet fibra Franco da Rocha, provedor internet SP, Acessanet Telecom, planos de internet fibra"
                />
                <meta name="author" content="Acessanet Telecom" />

                {/* Open Graph */}
                <meta property="og:title" content="Internet Fibra | Acessanet Telecom" />
                <meta
                    property="og:description"
                    content="Planos de internet rápida e estável para sua casa ou empresa. Confira agora!"
                />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://acessanet.com.br/" />
                <meta property="og:locale" content="pt_BR" />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Internet Fibra | Acessanet Telecom" />
                <meta
                    name="twitter:description"
                    content="Internet rápida e estável em Franco da Rocha. Veja nossos planos."
                />

                {/* Indexação */}
                <meta name="robots" content="index, follow" />
            </Helmet>
            <BannerCarousel />
            <Planos />
            <WatchTV />
            <TemSaude />
            <Graviola />
            <AppProvedor />
        </>
    )
}