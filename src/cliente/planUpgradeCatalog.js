import { BookOpen, PhoneCall, Stethoscope, Tv, Wifi } from "lucide-react";
import planosData from "./planosData";

/**
 * Catálogo da oferta de upgrade exibida na Central do Assinante (tela "Meu plano").
 * O preço de referência vem do mesmo dado usado na página pública /planos
 * (fonte única), mas a estrutura abaixo já está preparada para ser
 * substituída por um valor dinâmico vindo da API (ver `resolveRecommendedPlanPrice`).
 */

const RECOMMENDED_PLAN_ENTRY = planosData.find((plano) => plano.nome.startsWith("800"));

function parsePriceString(preco) {
  if (!preco) return undefined;
  const numeric = Number(String(preco).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : undefined;
}

export const RECOMMENDED_PLAN = {
  id: "800-mega",
  speedValue: "800",
  speedUnit: "MEGA",
  label: "800 Mega",
  tagline: "Internet + benefícios",
  price: parsePriceString(RECOMMENDED_PLAN_ENTRY?.preco)
};

export const PLAN_UPGRADE_BENEFITS = [
  {
    id: "internet-800",
    icon: Wifi,
    title: "Internet 800 Mega",
    description: "Mais velocidade para streaming, jogos e vários dispositivos conectados ao mesmo tempo."
  },
  {
    id: "telemedicina",
    icon: Stethoscope,
    title: "Telemedicina",
    description: "Atendimento médico de onde você estiver, quando precisar."
  },
  {
    id: "watch-tv",
    icon: Tv,
    title: "Watch TV + canais",
    description: "Entretenimento para toda a família, com combo de canais incluso."
  },
  {
    id: "ebooks",
    icon: BookOpen,
    title: "eBooks",
    description: "Uma biblioteca digital sempre disponível na palma da mão."
  },
  {
    id: "telefone-fixo",
    icon: PhoneCall,
    title: "Telefone fixo",
    description: "Mais uma forma de manter sua casa conectada."
  }
];

function toMbps(speed) {
  const value = Number(speed?.value);
  if (!Number.isFinite(value)) return undefined;
  return speed?.unit === "GIGA" ? value * 1000 : value;
}

/** Só faz sentido recomendar o upgrade se o plano atual for mais lento que o recomendado. */
export function isEligibleForUpgrade(currentSpeed) {
  const currentMbps = toMbps(currentSpeed);
  const targetMbps = Number(RECOMMENDED_PLAN.speedValue);
  return currentMbps !== undefined && currentMbps < targetMbps;
}

/**
 * Campos preparados para receber preço dinâmico do backend.
 * Hoje o contrato ainda não retorna um valor de mensalidade do plano (ver
 * ContractSummary em server/src/types.ts), então o resultado costuma ser
 * `undefined` — a UI deve tratar isso sem inventar um valor.
 */
export function resolveCurrentPlanPrice(contract) {
  const candidates = [contract?.planPrice, contract?.monthlyPrice, contract?.price];
  return candidates.find((value) => typeof value === "number" && Number.isFinite(value));
}

/** Prioriza um valor vindo da API (quando existir); usa o catálogo local como referência atual. */
export function resolveRecommendedPlanPrice(contract) {
  const apiPrice = contract?.upgradeOffer?.price;
  if (typeof apiPrice === "number" && Number.isFinite(apiPrice)) {
    return apiPrice;
  }
  return RECOMMENDED_PLAN.price;
}

export function calculatePriceDifference(currentPrice, upgradePrice) {
  if (typeof currentPrice !== "number" || typeof upgradePrice !== "number") {
    return undefined;
  }
  const diff = upgradePrice - currentPrice;
  return Number.isFinite(diff) ? diff : undefined;
}
