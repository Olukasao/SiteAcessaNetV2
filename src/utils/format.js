export function formatCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}
