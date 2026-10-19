export type NoticeType = "informativo" | "atencao" | "urgente" | "sucesso" | "manutencao" | "instabilidade";
export type NoticeDisplay = "banner" | "modal" | "card";
export type NoticePriority = "baixa" | "normal" | "alta" | "critica";
export type NoticeFrequency = "always" | "once_per_session" | "once_per_customer";
export type NoticeOrigin = "manual" | "incidente" | "manutencao" | "sistema";

/**
 * Dimensoes com dado real disponivel hoje (ContractSummary / customerId).
 * bairro/POP/OLT/regiao/grupo-de-clientes ficam de fora deliberadamente --
 * nenhum desses campos existe em lugar nenhum do backend (ver plano "Avisos
 * da Central", secao "Exclusoes deliberadas"). Adicionar um valor aqui no
 * futuro nao exige migration nova (audience_filter ja e um JSON livre).
 */
export type NoticeAudienceType = "all" | "contract" | "customer" | "plan" | "city" | "state" | "contract_status";

export type NoticeAudienceFilter =
  | { type: "all" }
  | { type: "contract"; contractIds: string[] }
  | { type: "customer"; customerIds: string[] }
  | { type: "plan"; planNames: string[] }
  | { type: "city"; cities: string[] }
  | { type: "state"; states: string[] }
  | { type: "contract_status"; statuses: string[] };

export interface Notice {
  id: string;
  title: string;
  message: string;
  /** URL http/https de uma imagem ja hospedada (sem upload/armazenamento proprio) -- validada no schema da rota, nunca renderizada como HTML. */
  imageUrl: string | null;
  type: NoticeType;
  display: NoticeDisplay;
  priority: NoticePriority;
  dismissible: boolean;
  frequency: NoticeFrequency;
  origin: NoticeOrigin;
  audienceType: NoticeAudienceType;
  audienceFilter: NoticeAudienceFilter | null;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  deletedAt: Date | null;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Campos que o cliente pode ver via GET /v1/notices/active -- nunca audienceFilter/createdBy/deletedAt. */
export interface PublicNotice {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  type: NoticeType;
  display: NoticeDisplay;
  priority: NoticePriority;
  dismissible: boolean;
  frequency: NoticeFrequency;
  version: number;
}

export interface NoticeAudienceContext {
  customerId: string;
  contract?: {
    id: string;
    city: string;
    state: string;
    planName: string;
    status: string;
  } | undefined;
}
