/**
 * Dias do painel no horário de Brasília. O servidor (Hostinger) roda em UTC e
 * os logs gravam created_at em ISO UTC; sem isso "hoje" virava às 21h e os
 * gráficos por hora saíam 3h adiantados. Brasil sem horário de verão desde
 * 2019, então o deslocamento é fixo.
 */
export const SAO_PAULO_OFFSET_HOURS = 3;
const OFFSET_MS = SAO_PAULO_OFFSET_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 00:00 em São Paulo do dia de `date`, como instante UTC. */
export function startOfSaoPauloDay(date: Date) {
  const local = new Date(date.getTime() - OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + OFFSET_MS);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** "AAAA-MM-DD" (input type=date) vira 00:00 desse dia em São Paulo; outro formato, Date normal. */
export function parseSaoPauloDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) + OFFSET_MS)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
