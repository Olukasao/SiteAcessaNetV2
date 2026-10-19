/**
 * Catalogo oficial de planos para a Solicitacao de Contratacao Online.
 *
 * FONTE DE PRECO = ESTE ARQUIVO (backend). O preco/nome gravados em cada
 * solicitacao sao copiados daqui no momento do pedido (snapshot) -- nunca do
 * corpo enviado pelo navegador.
 *
 * Dados copiados fielmente de acessanet-lab/src/data/site.js (`plans`,
 * `services`, `coveredCities`) em 2026-10-17. Nada inventado: qualquer
 * mudanca comercial precisa ser feita nos dois lugares (ver CONTRATO-API.md).
 */

export interface PlanBenefit {
  key: string;
  name: string;
  detail: string;
}

export interface CatalogPlan {
  id: string;
  name: string;
  speed: number;
  unit: "Mega";
  priceCents: number;
  priceText: string;
  benefits: PlanBenefit[];
  note: string;
  conditions: string[];
  /** Keys de beneficios que o comercial ainda precisa confirmar (site.js: pendingConfirmation). */
  pendingConfirmation: string[];
}

/** site.js `services` (somente nome/detalhe -- logos ficam no front). */
const SERVICES: Record<string, { name: string; detail: string }> = {
  globoplay: { name: "Globoplay", detail: "Padrão com anúncios" },
  livros: { name: "App Livros", detail: "Conteúdo para toda a família (Graviola Digital)" },
  watch: { name: "Watch TV + Premiere", detail: "Canais ao vivo e esportes" },
  espn: { name: "ESPN + SporTV", detail: "Canais esportivos no Watch TV" },
  temsaude: { name: "Telemedicina TemSaúde", detail: "Consultas sem sair de casa" },
  fixo: { name: "Telefone fixo", detail: "Minutagem ilimitada" }
};

/** Condicoes comerciais que ja existem no site (PlanModal.jsx / Hero.jsx / PlanLeadForm.jsx). */
const CONDITIONS = [
  "Para novos assinantes",
  "Internet 100% fibra óptica",
  "A contratação é concluída com nossa equipe comercial, que confirma a viabilidade técnica no seu endereço e as condições vigentes."
];

/** site.js `coveredCities` ("Laranjeiras" e distrito de Caieiras, consta na lista original). */
export const COVERED_CITIES: readonly string[] = ["Franco da Rocha", "Francisco Morato", "Caieiras", "Laranjeiras"];

/** Versao do aviso de privacidade exibido no formulario; gravada junto da ciencia do interessado. */
export const PRIVACY_NOTICE_VERSION = "2026-10-17";

function benefits(keys: string[]): PlanBenefit[] {
  return keys.map((key) => {
    const service = SERVICES[key];
    if (!service) throw new Error(`Beneficio desconhecido no catalogo: ${key}`);
    return { key, name: service.name, detail: service.detail };
  });
}

const PLANS: readonly CatalogPlan[] = [
  {
    id: "700",
    name: "Plano 700 Mega",
    speed: 700,
    unit: "Mega",
    priceCents: 11499,
    priceText: "R$ 114,99",
    benefits: benefits(["globoplay", "livros"]),
    note: "Para novos assinantes",
    conditions: CONDITIONS,
    pendingConfirmation: []
  },
  {
    id: "700-fixo",
    name: "Plano 700 Mega + Telefone Fixo",
    speed: 700,
    unit: "Mega",
    priceCents: 11499,
    priceText: "R$ 114,99",
    benefits: benefits(["fixo", "livros"]),
    note: "Para novos assinantes",
    conditions: CONDITIONS,
    pendingConfirmation: []
  },
  {
    id: "800",
    name: "Plano 800 Mega",
    speed: 800,
    unit: "Mega",
    priceCents: 16999,
    priceText: "R$ 169,99",
    benefits: benefits(["globoplay", "watch", "espn", "temsaude", "livros", "fixo"]),
    note: "Para novos assinantes",
    conditions: CONDITIONS,
    pendingConfirmation: ["espn", "livros", "fixo"]
  }
];

/** Copia defensiva: quem consome nunca altera o catalogo em memoria. */
function clonePlan(plan: CatalogPlan): CatalogPlan {
  return {
    ...plan,
    benefits: plan.benefits.map((benefit) => ({ ...benefit })),
    conditions: [...plan.conditions],
    pendingConfirmation: [...plan.pendingConfirmation]
  };
}

export function listCatalogPlans(): CatalogPlan[] {
  return PLANS.map(clonePlan);
}

export function findCatalogPlan(id: string): CatalogPlan | null {
  const plan = PLANS.find((entry) => entry.id === id);
  return plan ? clonePlan(plan) : null;
}

/** Minusculas, sem acentos, espacos colapsados -- "  FRANCO  da rócha " -> "franco da rocha". */
export function normalizeCityName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_COVERED = new Set(COVERED_CITIES.map(normalizeCityName));

/**
 * Cidade esta na lista de cidades atendidas. NAO e viabilidade tecnica (porta,
 * CTO, rua): isso continua sendo confirmado pelo comercial.
 */
export function isCityCovered(city: string) {
  return NORMALIZED_COVERED.has(normalizeCityName(city));
}
