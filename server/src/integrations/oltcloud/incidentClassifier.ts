export interface NormalizedAlert {
  id: string;
  alertType: string;
  oltId: string;
  oltName: string;
  initialDate: string | null;
  confirmDate: string | null;
  endDate: string | null;
  ignored: boolean;
  description: string;
  totalDevicesCount: number | null;
  activeDevicesCount: number | null;
  ponId: string;
  pon: string;
  slotPon: string;
  ctoId: string;
  ctoName: string;
}

/** Unicos alert_type com regra propria confirmada pela OLT Cloud ate agora -- qualquer outro valor e tratado como "desconhecido" (ver KNOWN_ALERT_TYPES). */
export const KNOWN_ALERT_TYPES = ["cto_loss", "pon_loss", "no_power"] as const;
export type KnownAlertType = (typeof KNOWN_ALERT_TYPES)[number];

export function isKnownAlertType(alertType: string): alertType is KnownAlertType {
  return (KNOWN_ALERT_TYPES as readonly string[]).includes(alertType);
}

/**
 * pon_loss tem prioridade sobre qualquer inferencia local de queda massiva
 * de PON (ver regra 10 do pedido de deteccao automatica) -- nunca descartar
 * um alerta assim so porque outra fonte (ex. equipment/list) diverge na
 * contagem.
 */
export function isPonOutageAlert(alert: NormalizedAlert): boolean {
  return alert.alertType === "pon_loss";
}

export function normalizeAlert(raw: Record<string, unknown>): NormalizedAlert {
  return {
    id: pickString(raw, ["id"]),
    alertType: pickString(raw, ["alert_type"]),
    oltId: pickString(raw, ["olt_id"]),
    oltName: pickString(raw, ["olt_name"]),
    initialDate: pickString(raw, ["initial_date"]) || null,
    confirmDate: pickString(raw, ["confirm_date"]) || null,
    endDate: pickString(raw, ["end_date"]) || null,
    ignored: pickBool(raw, "ignored"),
    description: pickString(raw, ["description"]),
    totalDevicesCount: pickNumber(raw, "total_devices_count"),
    activeDevicesCount: pickNumber(raw, "active_devices_count"),
    ponId: pickString(raw, ["pon_id"]),
    pon: pickString(raw, ["pon"]),
    slotPon: pickString(raw, ["slot_pon"]),
    ctoId: pickString(raw, ["cto_id"]),
    ctoName: pickString(raw, ["cto_name"])
  };
}

/**
 * Criterios adotados para "incidente de rede ativo" (documentado a pedido --
 * revisar aqui antes de mudar o comportamento da Central do Assinante):
 *
 * 1. end_date == null -- a OLT Cloud ainda nao marcou o alerta como
 *    encerrado. Condicao necessaria, mas nao suficiente sozinha (por isso
 *    os itens abaixo).
 * 2. ignored !== true -- um alerta que a operacao marcou como "ignore" na
 *    OLT Cloud nao deve gerar aviso ao cliente (falso positivo conhecido,
 *    ex: manutencao programada, teste de campo).
 * 3. active_devices_count, quando o campo vier preenchido, precisa ser > 0.
 *    Se zerou mas o end_date ainda nao foi preenchido (lag da OLT Cloud),
 *    tratamos como resolvido -- nenhum dispositivo mais impactado.
 * 4. confirm_date NAO entra no criterio: representa confirmacao humana/
 *    operacional, nao o estado real da rede. Um alerta pode estar ativo e
 *    afetando clientes mesmo sem ter sido confirmado ainda por alguem do NOC.
 * 5. alert_type NAO entra no criterio de "ativo ou nao" -- so na
 *    classificacao (ver isKnownAlertType). Um alert_type desconhecido ainda
 *    pode ser um incidente ativo real; so nao criamos regra propria pra ele.
 */
export function isActiveNetworkIncident(alert: NormalizedAlert): boolean {
  if (alert.endDate) {
    return false;
  }
  if (alert.ignored) {
    return false;
  }
  if (alert.activeDevicesCount !== null && alert.activeDevicesCount <= 0) {
    return false;
  }
  return true;
}

export function groupAlertsByType(alerts: NormalizedAlert[]): Record<string, NormalizedAlert[]> {
  const groups: Record<string, NormalizedAlert[]> = {};
  for (const alert of alerts) {
    const key = alert.alertType || "unknown";
    (groups[key] ??= []).push(alert);
  }
  return groups;
}

function pickString(record: Record<string, unknown>, fields: string[]): string {
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function pickNumber(record: Record<string, unknown>, field: string): number | null {
  const value = record[field];
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickBool(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  return value === true || value === "true" || value === 1 || value === "1";
}
