export const fixedLinePlan = {
  serviceTag: "Telefonia Fixa",
  badge: "Novidade",
  name: "Linha Fixa Acessanet",
  price: 49.99,
  pricePrefix: "Por apenas",
  period: "/mês",
  title: "Linha Fixa Acessanet",
  subtitle: "Comunicação com qualidade e estabilidade para o seu dia a dia.",
  description:
    "Tenha uma linha fixa para sua casa ou empresa, com áudio claro, conexão estável e suporte dedicado da Acessanet.",
  secondaryDescription:
    "Conheça as condições de instalação, contratação e portabilidade da Linha Fixa Acessanet.",
  whatsappPhone: "5508004445799",
};

export const fixedLineBenefits = [
  { icon: "audio", text: "Áudio claro e estável" },
  { icon: "shield", text: "Confiança e estabilidade" },
  { icon: "support", text: "Suporte dedicado" },
  { icon: "home", text: "Ideal para residências" },
  { icon: "business", text: "Ideal para empresas" },
  { icon: "portability", text: "Portabilidade do número" },
  { icon: "team", text: "Atendimento da equipe Acessanet" },
];

export const fixedLineFaqs = [
  {
    question: "Posso manter meu número atual?",
    answer:
      "É possível consultar a portabilidade do número fixo atual. A solicitação está sujeita à análise e condições aplicáveis.",
  },
  {
    question: "O plano pode ser contratado por empresas?",
    answer:
      "A Linha Fixa pode atender residências e empresas, conforme as condições de contratação.",
  },
  {
    question: "Qual é o valor mensal?",
    answer:
      "O plano divulgado possui valor de {priceText} por mês. Consulte as condições completas antes da contratação.",
  },
  {
    question: "Existe instalação?",
    answer:
      "A necessidade e as condições de instalação devem ser confirmadas durante o atendimento e dependem da estrutura disponível no endereço.",
  },
  {
    question: "Como solicitar a portabilidade?",
    answer:
      "Entre em contato com a equipe da Acessanet, informe que deseja realizar a portabilidade e aguarde a análise dos dados.",
  },
  {
    question: "Preciso apresentar algum documento?",
    answer:
      "A equipe comercial informará os dados e documentos necessários para contratação ou portabilidade.",
  },
];

export function formatFixedLinePrice(price = fixedLinePlan.price) {
  return price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).replace(/\u00a0/g, " ");
}

export function getFixedLinePriceParts(price = fixedLinePlan.price) {
  const [integer, cents = "00"] = price
    .toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .split(",");

  return { integer, cents };
}

export function getFixedLineConditions(priceText = formatFixedLinePrice()) {
  return [
    `Plano de Linha Fixa por ${priceText} por mês`,
    "Consulte eventuais taxas aplicáveis antes da contratação",
    "Portabilidade sujeita à análise cadastral e regras aplicáveis",
    "O cliente deverá fornecer os dados necessários para contratação ou portabilidade",
    "A contratação poderá depender da confirmação de dados cadastrais",
    "Valores e condições poderão ser confirmados pelo atendimento",
    "Serviço destinado a endereços atendidos pela Acessanet",
    "Consulte as condições completas com a equipe comercial",
  ];
}

export function getFixedLineWhatsappMessages(priceText = formatFixedLinePrice()) {
  return {
    contract:
      `Olá! Tenho interesse no plano de Linha Fixa Acessanet por ${priceText}/mês. ` +
      "Gostaria de seguir com a contratação e confirmar as condições.",
    portability:
      "Olá! Tenho interesse na Linha Fixa Acessanet e gostaria de consultar a portabilidade do meu número fixo atual.",
    conditions:
      `Olá! Gostaria de consultar as condições completas do plano de Linha Fixa Acessanet por ${priceText}/mês.`,
  };
}

export function getFixedLineWhatsappUrl(message, phone = fixedLinePlan.whatsappPhone) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
