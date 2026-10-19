import type { SupportCategory } from "../types.js";

export const supportCategories: SupportCategory[] = [
  {
    id: "no_internet",
    title: "Sem internet",
    description: "Nao consigo acessar a internet pelo Wi-Fi ou cabo."
  },
  {
    id: "slow_internet",
    title: "Internet lenta",
    description: "A conexao esta abaixo do esperado."
  },
  {
    id: "intermittent",
    title: "Internet caindo",
    description: "A conexao cai e volta durante o dia."
  },
  {
    id: "wifi_problem",
    title: "Problema no Wi-Fi",
    description: "Sinal fraco, rede nao aparece ou alguns aparelhos nao conectam."
  },
  {
    id: "router_password",
    title: "Troca de senha do roteador",
    description: "Solicitar alteracao da senha do Wi-Fi."
  },
  {
    id: "websites",
    title: "Alguns sites nao funcionam",
    description: "Um site ou servico especifico nao abre."
  },
  {
    id: "equipment",
    title: "Equipamento/modem",
    description: "Luzes, cabos, energia ou equipamento."
  },
  {
    id: "phone",
    title: "Telefone",
    description: "Problemas relacionados ao telefone fixo."
  },
  {
    id: "other",
    title: "Outro problema",
    description: "Nao encontrei meu problema nas opcoes."
  }
];
