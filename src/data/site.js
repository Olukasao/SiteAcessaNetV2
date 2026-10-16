// Fonte única de dados comerciais do lab. TUDO aqui foi copiado do site em
// produção (/home/noc/Site-Acessanet) -- nenhum preço, velocidade, benefício
// ou cidade foi inventado. Origem de cada bloco anotada ao lado.

import logoTemSaude from "../assets/temSaude.png";
import logoWatch from "../assets/watchTV.jpg";
import logoGraviola from "../assets/graviola.png";
import logoGloboplay from "../assets/globoplay-icon.png";
import logoEspn from "../assets/espn.png";
import { PhoneCall } from "lucide-react";

// Footer.jsx / WhatsAppButton.jsx
export const company = {
  name: "AcessaNet",
  legalName: "ACESSANET TELECON LTDA",
  cnpj: "23.094.376/0001-08",
  since: 2015,
  originalDeveloper: "Lucas Soares",
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
  espn: { name: "ESPN + SporTV", detail: "Canais esportivos no Watch TV", logo: logoEspn, dark: false, fit: "pad" },
  temsaude: { name: "Telemedicina TemSaúde", detail: "Consultas sem sair de casa", logo: logoTemSaude, dark: false },
  fixo: { name: "Telefone fixo", detail: "Minutagem ilimitada", logo: null, icon: PhoneCall },
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
    variant: "com Globoplay",
    short: "700 Mega",
    note: "Para novos assinantes",
  },
  {
    // Mesmo 700 Mega, com telefone fixo no lugar do Globoplay (pedido do
    // usuário em 2026-10-13). Preço assumido igual ao 700 -- confirmar.
    id: "700-fixo",
    speed: 700,
    unit: "Mega",
    name: "Plano 700 Mega + Telefone Fixo",
    price: { int: "114", cents: "99" },
    priceText: "R$ 114,99",
    tagline: "Internet rápida e estável com telefone fixo para falar à vontade.",
    featured: false,
    includes: ["fixo", "livros"],
    variant: "com Telefone fixo",
    short: "700 + Fixo",
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
    short: "800 Mega",
    note: "Para novos assinantes",
  },
];

// Ordem de vitrine (hero e cards de planos): mais rápido primeiro -- 800 Mega,
// depois os 700. `plans` continua crescente para o comparativo.
export const plansBySpeed = [...plans].sort((a, b) => b.speed - a.speed);

const compareServices = [
  ["globoplay", "Globoplay (padrão com anúncios)"],
  ["livros", "App Livros (Graviola Digital)"],
  ["fixo", "Telefone fixo ilimitado"],
  ["watch", "Watch TV + Premiere"],
  ["espn", "ESPN + SporTV"],
  ["temsaude", "Telemedicina TemSaúde"],
];
export const comparisonRows = [
  { label: "Velocidade", values: plans.map((p) => `${p.speed} ${p.unit}`) },
  { label: "Fibra óptica", values: plans.map(() => true) },
  ...compareServices.map(([key, label]) => ({ label, values: plans.map((p) => p.includes.includes(key)) })),
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

// Contratos (mesmos PDFs de src/assets/docs da produção). Descrições tiradas
// do próprio conteúdo/registro de cada PDF.
export const contracts = [
  {
    id: "acs",
    code: "A.C.S",
    title: "Contrato de Prestação de Serviços de Comunicação Multimídia (SCM)",
    party: "AcessaNet Telecom",
    audience: "Contratante pessoa jurídica (empresas)",
    registry: "Registrado no Cartório de Franco da Rocha · nº 33.641 · 06/03/2026",
    pages: 13,
    size: "386 KB",
    href: "/docs/ACS.pdf",
  },
  {
    id: "cde",
    code: "C.D.E",
    title: "Contrato de Prestação de Serviços de Comunicação Multimídia (SCM)",
    party: "CDE Tecnologia da Comunicação",
    audience: "Contratante pessoa física",
    registry: "Registrado no Cartório de Franco da Rocha · nº 33.640 · 06/03/2026",
    pages: 13,
    size: "381 KB",
    href: "/docs/CDE.pdf",
  },
  {
    id: "dec",
    code: "D.E.C",
    title: "Contrato de Prestação de Serviço",
    party: "DEC Tecnologia da Comunicação Ltda",
    audience: "Condições, direitos e responsabilidades entre as partes",
    registry: "Registrado no Cartório de Francisco Morato · nº 2870 · 24/02/2026",
    pages: 14,
    size: "10,3 MB",
    href: "/docs/DEC.pdf",
  },
];

export const wifiGuideUrl = "/boas-praticas-wifi";
