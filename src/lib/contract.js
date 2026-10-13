import { whatsappLink } from "../data/site";

// Monta a mensagem de contratação (mesmo canal da produção: WhatsApp 0800).
export function contractLink(plan, coverage) {
  let text = `Olá! Quero contratar o ${plan.name} por ${plan.priceText}/mês.`;
  if (coverage?.cep) {
    text += ` Meu CEP é ${coverage.cep}`;
    if (coverage.city) text += ` (${coverage.street ? coverage.street + ", " : ""}${coverage.city})`;
    text += ".";
  }
  return whatsappLink(text);
}
