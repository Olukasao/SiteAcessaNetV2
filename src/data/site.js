// Fonte única de dados comerciais do lab. TUDO aqui foi copiado do site em
// produção (/home/noc/Site-Acessanet) -- nenhum preço, velocidade, benefício
// ou cidade foi inventado. Origem de cada bloco anotada ao lado.

import logoTemSaude from "../assets/temSaude.png";
import logoWatch from "../assets/watchTV.jpg";
import logoGraviola from "../assets/graviola.png";
import logoGloboplay from "../assets/globoplay.png";

// Footer.jsx / WhatsAppButton.jsx
export const company = {
  name: "AcessaNet",
  legalName: "ACESSANET TELECON LTDA",
  cnpj: "23.094.376.0001-08",
  since: 2015,
  phone: "0800 444 5799",
  phoneHref: "tel:08004445799",
  whatsapp: "5508004445799",
  supportHours: "Segunda a segunda, 24h",
  centralUrl: "https://acessanet.com.br/cliente",
  apps: {
    ios: "https://apps.apple.com/br/app/meuappprovedor/id1637448837",
    android: "https://play.google.com/store/apps/details?id=br.net.tsmx.meuappprovedor",
  },
};

// Disponibilidade.jsx (cobertura é verificada POR CIDADE via ViaCEP --
// "Laranjeiras" é distrito de Caieiras e aparece na lista original).
export const coveredCities = ["Franco da Rocha", "Francisco Morato", "Caieiras", "Laranjeiras"];
export const coveredCitiesLabel = "Caieiras, Francisco Morato e Franco da Rocha";

export function whatsappLink(text) {
  return `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
}

// Serviços inclusos -- logos/nomes de planosData.js e TemaSection.jsx.
export const services = {
  globoplay: { name: "Globoplay", detail: "Padrão com anúncios", logo: logoGloboplay, dark: false },
  livros: { name: "App Livros", detail: "Conteúdo para toda a família (Graviola Digital)", logo: logoGraviola, dark: true },
  watch: { name: "Watch TV + Premiere", detail: "Canais ao vivo e esportes", logo: logoWatch, dark: false },
  espn: { name: "ESPN + SporTV", detail: "Canais esportivos no Watch TV", logo: null },
  temsaude: { name: "Telemedicina TemSaúde", detail: "Consultas sem sair de casa", logo: logoTemSaude, dark: false },
  fixo: { name: "Telefone fixo", detail: "Minutagem ilimitada", logo: null },
};

// Planos residenciais. Preço/velocidade/benefícios de TemaSection.jsx (página
// /planos) + planosData.js (home). ATENÇÃO: as duas fontes em produção
// divergem no 800 Mega -- a home lista "ESPN + SporTV" e "App Livros", a
// /planos lista "Telefone fixo". Aqui usamos a união das duas, sinalizada
// em `pendingConfirmation` até o comercial confirmar.
export const plans = [
  {
    id: "700",
    speed: 700,
    unit: "Mega",
    name: "Plano 700 Mega",
    price: { int: "114", cents: "99" },
    priceText: "R$ 114,99",
    tagline: "Internet rápida e estável para aproveitar todos os momentos.",
    featured: false,
    includes: ["globoplay", "livros"],
    note: "Para novos assinantes",
  },
  {
    id: "800",
    speed: 800,
    unit: "Mega",
    name: "Plano 800 Mega",
    price: { int: "169", cents: "99" },
    priceText: "R$ 169,99",
    tagline: "Mais conexão e entretenimento para toda a família.",
    featured: true,
    badge: "Mais contratado",
    includes: ["globoplay", "watch", "espn", "temsaude", "livros", "fixo"],
    pendingConfirmation: ["espn", "livros", "fixo"],
    note: "Para novos assinantes",
  },
];

export const comparisonRows = [
  { label: "Velocidade", values: ["700 Mega", "800 Mega"] },
  { label: "Fibra óptica", values: [true, true] },
  { label: "Globoplay (padrão com anúncios)", values: [true, true] },
  { label: "App Livros (Graviola Digital)", values: [true, true] },
  { label: "Watch TV + Premiere", values: [false, true] },
  { label: "ESPN + SporTV", values: [false, true] },
  { label: "Telemedicina TemSaúde", values: [false, true] },
  { label: "Telefone fixo ilimitado", values: [false, true] },
];

// linhaFixaData.js
export const fixedLine = {
  name: "Linha Fixa AcessaNet",
  priceText: "R$ 49,99",
  price: { int: "49", cents: "99" },
  description:
    "Linha fixa para sua casa ou empresa, com áudio claro, conexão estável e suporte dedicado da AcessaNet.",
  benefits: ["Áudio claro e estável", "Portabilidade do número", "Ideal para residências e empresas", "Suporte dedicado"],
};

// TemSaude.jsx
export const temSaudePlans = [
  { name: "Individual", priceText: "R$ 10,99", items: ["Consultas com desconto", "Exames mais baratos", "Farmácias conveniadas"] },
  { name: "Familiar", priceText: "R$ 19,99", items: ["Titular + 3 dependentes", "Todos os benefícios inclusos", "Melhor custo-benefício"] },
];

// pages/Planos.jsx (bloco .corp)
export const businessPlans = [
  {
    name: "Comercial",
    badge: "Mais comum",
    description: "Ideal para escritórios, lojas e pequenas empresas.",
    items: ["Alta velocidade", "Wi-Fi corporativo", "Suporte ágil"],
    footer: "A partir de 300 Mega",
  },
  {
    name: "Dedicado",
    badge: "Performance máxima",
    description: "Para operações críticas que exigem estabilidade total.",
    items: ["Banda 100% garantida", "IP fixo", "SLA com prioridade"],
    footer: "Sob consulta",
    highlight: true,
  },
];

// AppProvedor.jsx
export const appFeatures = ["Segunda via de fatura", "Pagamento via Pix", "Teste de velocidade", "Suporte imediato"];
