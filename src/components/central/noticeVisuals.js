import { AlertCircle, AlertTriangle, CheckCircle2, Info, Megaphone, Zap } from "lucide-react";

/**
 * Um icone + uma cor por tipo de aviso, usando os tokens --cliente-* ja
 * existentes (ver src/styles/clienteArea.css) -- so "instabilidade" precisou
 * de um token novo (--cliente-orange), nenhum outro foi inventado.
 */
export const noticeVisuals = {
  informativo: { icon: Info, colorVar: "--cliente-blue", tone: "blue" },
  atencao: { icon: AlertTriangle, colorVar: "--cliente-amber", tone: "amber" },
  urgente: { icon: AlertCircle, colorVar: "--cliente-red", tone: "red" },
  sucesso: { icon: CheckCircle2, colorVar: "--cliente-green", tone: "green" },
  manutencao: { icon: Megaphone, colorVar: "--cliente-navy-2", tone: "navy" },
  instabilidade: { icon: Zap, colorVar: "--cliente-orange", tone: "orange" }
};

export function getNoticeVisual(type) {
  return noticeVisuals[type] || noticeVisuals.informativo;
}

export const noticePriorityWeight = { critica: 3, alta: 2, normal: 1, baixa: 0 };
