import { Helmet } from "react-helmet-async";
import AppProvedor from "../components/AppProvedor";
import AwarenessSection from "../components/campaign/AwarenessSection";
import BenefitsSection from "../components/landing/BenefitsSection";
import Graviola from "../components/Graviola";
import HeroSection from "../components/landing/HeroSection";
import LinhaFixaSection from "../components/LinhaFixaSection";
import Planos from "../components/Planos";
import StatsBar from "../components/landing/StatsBar";
import TemSaude from "../components/TemSaude";
import WatchTV from "../components/WatchTV";
import { seasonalCampaign } from "../theme/siteTheme";
import "../styles/landing.css";

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Internet Fibra em Franco da Rocha | Acessanet Telecom</title>

        <meta
          name="description"
          content="Internet fibra óptica rápida, estável e com atendimento de qualidade para sua casa. Consulte a disponibilidade da Acessanet Telecom."
        />

        <meta
          name="keywords"
          content="internet fibra Franco da Rocha, provedor internet SP, Acessanet Telecom, planos de internet fibra"
        />
        <meta name="author" content="Acessanet Telecom" />

        <meta property="og:title" content="Internet Fibra | Acessanet Telecom" />
        <meta
          property="og:description"
          content="Planos de internet rápida e estável para sua casa. Consulte disponibilidade."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://acessanet.com.br/" />
        <meta property="og:locale" content="pt_BR" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Internet Fibra | Acessanet Telecom" />
        <meta
          name="twitter:description"
          content="Internet rápida e estável em Franco da Rocha. Veja nossos planos."
        />

        <meta name="robots" content="index, follow" />
      </Helmet>

      <main className="landing-page">
        <HeroSection />
        <StatsBar />
        <BenefitsSection />
        <Planos />
        <LinhaFixaSection source="home" />
        <WatchTV />
        <TemSaude />
        {seasonalCampaign.enabled && <AwarenessSection />}
        <Graviola />
        <AppProvedor />
      </main>
    </>
  );
}
