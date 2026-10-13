import { useEffect } from "react";
import { GuideHero, GuideNav } from "../guia-wifi/GuideHeaderHero";
import {
  FiberCoverage,
  InternetVsWifi,
  RouterCare,
  SharedConnection,
  SpeedTestGuide,
  SpeedVsRange,
  SupportChecklist,
  WifiSignal,
} from "../guia-wifi/GuideContentSections";
import { GuideFAQ, SupportCTA } from "../guia-wifi/GuideFAQCTA";
import { whatsappLink } from "../data/site";
import "../guia-wifi/guiaWifi.css";
import "../guia-wifi/guiaWifi.lab.css";

// Conteúdo e componentes do guia são os mesmos da produção
// (src/components/guia-wifi); só o visual é reamarrado ao design system
// do lab em guiaWifi.lab.css. Header/rodapé próprios do guia não são
// usados -- a página fica dentro do Header/Footer do site novo.
const supportUrl = whatsappLink("Olá, preciso de atendimento para minha internet AcessaNet.");

export default function GuiaWifiPage() {
  useEffect(() => {
    document.title = "Boas práticas Wi-Fi | AcessaNet";
  }, []);

  return (
    <div className="guia-wifi-page guia-wifi-page--lab">
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
      <SupportCTA supportUrl={supportUrl} onSupportClick={() => {}} />
    </div>
  );
}
