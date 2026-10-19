// Anúncios da tela de espera do Wi-Fi público (entre o cadastro e a liberação).
// Para trocar/adicionar anúncio, edite a lista `wifiAds`. Preços e planos vêm de
// site.js (fonte única); aqui só o texto de apresentação. Não são links: antes do
// login o celular só alcança este site, e sair da página interromperia a liberação.

import { company, plans } from "./site";

export const WIFI_WAIT_SECONDS = 10;

const plan800 = plans.find((plan) => plan.id === "800");
const plan700 = plans.find((plan) => plan.id === "700");

export const wifiAds = [
  plan800 && {
    id: "plano-800",
    tag: plan800.badge || "Plano",
    title: `${plan800.speed} ${plan800.unit} por ${plan800.priceText}/mês`,
    text: plan800.tagline,
    cta: `Contrate pelo 0800 ou WhatsApp`,
  },
  plan700 && {
    id: "plano-700",
    tag: "Fibra óptica",
    title: `${plan700.speed} ${plan700.unit} por ${plan700.priceText}/mês`,
    text: plan700.tagline,
    cta: `Fale com a gente: ${company.phone}`,
  },
  {
    id: "app",
    tag: "App AcessaNet",
    title: "Sua conta na palma da mão",
    text: "Segunda via de fatura, pagamento via Pix, teste de velocidade e suporte imediato.",
    cta: "Baixe na App Store ou Google Play",
  },
  {
    id: "suporte",
    tag: "Suporte 24h",
    title: "Suporte de segunda a segunda, 24h",
    text: "Precisou de ajuda com a sua internet? A gente atende a qualquer hora.",
    cta: company.phone,
  },
].filter(Boolean);
