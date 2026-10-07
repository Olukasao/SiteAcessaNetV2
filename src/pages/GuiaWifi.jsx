import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import {
  GuideHeader,
  GuideHero,
  GuideNav,
} from "../components/guia-wifi/GuideHeaderHero";
import {
  FiberCoverage,
  InternetVsWifi,
  RouterCare,
  SharedConnection,
  SpeedTestGuide,
  SpeedVsRange,
  SupportChecklist,
  WifiSignal,
} from "../components/guia-wifi/GuideContentSections";
import {
  GuideFAQ,
  GuideFooter,
  SupportCTA,
} from "../components/guia-wifi/GuideFAQCTA";
import logoOg from "../assets/logoog2.png";
import "../styles/guiaWifi.css";

const supportMessage = "Olá, preciso de atendimento para minha internet AcessaNet.";
const supportUrl = `https://wa.me/5508004445799?text=${encodeURIComponent(supportMessage)}`;
const pageTitle = "Guia de Boas Práticas para sua Internet | AcessaNet";
const pageDescription =
  "Veja dicas para melhorar seu Wi-Fi, posicionar corretamente o roteador, entender velocidade e alcance e aproveitar melhor sua internet AcessaNet.";

function getTrackingContext() {
  const searchParams = new URLSearchParams(window.location.search);
  const utm = {};

  searchParams.forEach((value, key) => {
    if (key.startsWith("utm_")) {
      utm[key] = value;
    }
  });

  return {
    page_path: window.location.pathname,
    page_search: window.location.search,
    page_location: window.location.href,
    ...utm,
  };
}

function trackGuideEvent(eventName, payload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const eventPayload = {
    event: eventName,
    ...getTrackingContext(),
    ...payload,
  };

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(eventPayload);
  }

  if (typeof window.gtag === "function") {
    const { event, ...gtagPayload } = eventPayload;
    window.gtag("event", event, gtagPayload);
  }
}

export default function GuiaWifi() {
  useEffect(() => {
    trackGuideEvent("boas_praticas_page_view");
  }, []);

  const handleSupportClick = (source) => {
    trackGuideEvent("boas_praticas_support_click", { source });
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />

        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://acessanet.com.br/cliente/guia-wifi" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:image" content={logoOg} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={logoOg} />
      </Helmet>

      <div className="guia-wifi-page">
        <GuideHeader supportUrl={supportUrl} onSupportClick={handleSupportClick} />

        <main>
          <GuideHero />
          <GuideNav />
          <SpeedVsRange />
          <RouterCare />
          <WifiSignal />
          <SharedConnection />
          <SpeedTestGuide />
          <FiberCoverage />
          <InternetVsWifi />
          <SupportChecklist />
          <GuideFAQ />
          <SupportCTA supportUrl={supportUrl} onSupportClick={handleSupportClick} />
        </main>

        <GuideFooter supportUrl={supportUrl} onSupportClick={handleSupportClick} />
      </div>
    </>
  );
}
