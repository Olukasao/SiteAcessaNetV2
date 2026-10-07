// Campanha sazonal ativa. Para encerrar a campanha e voltar ao tema padrão
// da AcessaNet, basta trocar `enabled` para `false` (ou apagar `theme`).
export const seasonalCampaign = {
  enabled: true,
  theme: "outubro-rosa",
};

const availableThemes = new Set(["default", "independencia", "outubro-rosa"]);

export function applySiteTheme(selectedTheme) {
  const resolvedTheme =
    selectedTheme ?? (seasonalCampaign.enabled ? seasonalCampaign.theme : "default");
  const normalizedTheme = availableThemes.has(resolvedTheme)
    ? resolvedTheme
    : "default";

  document.documentElement.dataset.theme = normalizedTheme;
  document.body.dataset.theme = normalizedTheme;
  document.body.classList.remove(
    "theme-default",
    "theme-independencia",
    "theme-outubro-rosa"
  );
  document.body.classList.add(`theme-${normalizedTheme}`);
}
