import type {
  ActivityLogEntry,
  AnalyticsRange,
  CentralActivityRepository
} from "../repositories/centralActivityRepository.js";
import type { ContractProvider, TicketProvider, TicketSummaryWithRaw } from "../integrations/sgp/providers.js";
import { mapSgpOsToCustomerVisit } from "../integrations/sgp/sgpMapper.js";
import type { ContractSummary, PublicTicketVisit, TicketInternalStatus } from "../types.js";
import { AppError } from "../errors.js";

/** Teto de linhas carregadas em memoria para filtrar/ordenar por status ou updatedAt (que so existem ao vivo no SGP, nunca em coluna SQL) -- acima disso, avisa pra estreitar o periodo em vez de truncar silenciosamente. */
const STATUS_ENRICH_ROW_CAP = 1000;
/** Teto de linhas exportadas por CSV -- mesma logica, nao deixa um filtro largo demais travar o processo. */
const EXPORT_ROW_CAP = 5000;
/** TTL do cache de ocorrencias SGP por contrato -- evita refazer a mesma consulta a cada linha da mesma pagina/exportacao. */
const SGP_CACHE_TTL_MS = 60_000;

export type TicketStatusFilter = TicketInternalStatus;

const STATUS_LABELS: Record<TicketInternalStatus | "unknown", string> = {
  open: "Aberto",
  scheduled: "Agendado",
  in_progress: "Em atendimento",
  closed: "Encerrado",
  unknown: "Indisponível"
};

export interface TicketListFilters {
  range: AnalyticsRange;
  page: number;
  limit: number;
  search?: string | undefined;
  status?: TicketStatusFilter | undefined;
  contractId?: string | undefined;
  customerId?: string | undefined;
  sort: "createdAt_desc" | "createdAt_asc" | "updatedAt_desc" | "updatedAt_asc";
}

export interface AdminTicketListItem {
  activityId: number;
  ticketId: string | null;
  protocol: string | null;
  customerId: string;
  customerName: string | null;
  cpfMasked: string | null;
  sgpCustomerId: string | null;
  contractId: string | null;
  title: string;
  openedAt: string;
  updatedAt: string;
  status: TicketInternalStatus | "unknown";
  statusLabel: string;
  statusRaw: string | null;
}

export interface TicketListResult {
  items: AdminTicketListItem[];
  page: number;
  limit: number;
  total: number;
  /** true quando o periodo selecionado tinha mais linhas do que o teto de enriquecimento (so acontece com filtro de status/updatedAt) -- pedir pra estreitar o periodo. */
  truncated: boolean;
}

export interface TicketStatusSummary {
  total: number;
  openedToday: number;
  opened7d: number;
  byStatus: Record<TicketInternalStatus | "unknown", number>;
  truncated: boolean;
}

export interface TicketDetail {
  activityId: number;
  ticketId: string | null;
  protocol: string;
  customerId: string;
  customerName: string | null;
  cpfMasked: string | null;
  sgpCustomerId: string | null;
  contractId: string;
  title: string;
  openedAt: string;
  updatedAt: string;
  closedAt: string | null;
  status: TicketInternalStatus | "unknown";
  statusLabel: string;
  statusRaw: string | null;
  description: string | null;
  closureReason: string | null;
  connectionStatus: "ONLINE" | "OFFLINE" | undefined;
  contract: ContractSummary | null;
  customerHistory: AdminTicketListItem[];
  contractHistory: AdminTicketListItem[];
}

/**
 * "to" usa um ano de 4 digitos de proposito (nunca new Date(8640000000000000), o maximo do JS):
 * toISOString() de um ano de 6 digitos ganha um prefixo "+" (ex. "+275760-09-13..."), e a
 * comparacao "created_at < ?" no SQL e por STRING -- "+" (0x2B) e lexicograficamente MENOR que
 * qualquer digito, entao created_at (sempre comeca com um ano de 4 digitos, ex. "2026-...")
 * nunca seria considerado "<" um limite "+275760...", e a janela "all time" nao devolvia nada.
 */
const ALL_TIME_RANGE: AnalyticsRange = { from: new Date(0), to: new Date("9999-12-31T23:59:59.999Z") };

export class AdminTicketService {
  private readonly contractOccurrenceCache = new Map<string, { expiresAt: number; items: TicketSummaryWithRaw[] }>();

  constructor(
    private readonly activityRepository: CentralActivityRepository,
    private readonly ticketProvider: TicketProvider,
    private readonly contractProvider: ContractProvider
  ) {}

  async listTickets(filters: TicketListFilters): Promise<TicketListResult> {
    const needsEnrichedWindow = Boolean(filters.status) || filters.sort.startsWith("updatedAt");

    if (!needsEnrichedWindow) {
      const order = filters.sort === "createdAt_asc" ? "asc" : "desc";
      const result = await this.activityRepository.listActivity({
        range: filters.range,
        page: filters.page,
        limit: filters.limit,
        eventType: "OPEN_TICKET",
        contractId: filters.contractId,
        customerId: filters.customerId,
        search: filters.search,
        order
      });

      const items = await this.enrichRows(result.items);
      return { items, page: result.page, limit: result.limit, total: result.total, truncated: false };
    }

    const { rows, truncated } = await this.loadWindow(filters.range, {
      contractId: filters.contractId,
      customerId: filters.customerId,
      search: filters.search
    });

    let items = await this.enrichRows(rows);

    if (filters.status) {
      items = items.filter((item) => item.status === filters.status);
    }

    items = sortItems(items, filters.sort);

    const total = items.length;
    const offset = (filters.page - 1) * filters.limit;
    const page = items.slice(offset, offset + filters.limit);

    return { items: page, page: filters.page, limit: filters.limit, total, truncated };
  }

  async getSummary(range: AnalyticsRange): Promise<TicketStatusSummary> {
    const [total, openedToday, opened7d] = await Promise.all([
      this.countInRange(ALL_TIME_RANGE),
      this.countInRange(todayRange()),
      this.countInRange(daysAgoRange(7))
    ]);

    const { rows, truncated } = await this.loadWindow(range, {});
    const enriched = await this.enrichRows(rows);

    const byStatus: Record<TicketInternalStatus | "unknown", number> = {
      open: 0,
      scheduled: 0,
      in_progress: 0,
      closed: 0,
      unknown: 0
    };
    for (const item of enriched) {
      byStatus[item.status] += 1;
    }

    return { total, openedToday, opened7d, byStatus, truncated };
  }

  async getDetail(protocol: string): Promise<TicketDetail> {
    const row = await this.findActivityRowByProtocol(protocol);
    if (!row || !row.contractId) {
      throw new AppError(404, "TICKET_NOT_FOUND", "Chamado não encontrado.");
    }

    const [contract, occurrences] = await Promise.all([
      this.contractProvider.getContract(row.contractId).catch(() => null),
      this.getContractOccurrences(row.contractId)
    ]);

    const match = occurrences.find((occurrence) => occurrence.protocol === protocol);
    const visit: PublicTicketVisit | null = match ? mapSgpOsToCustomerVisit(match.raw, row.contractId) : null;

    const title = (row.metadata?.title as string | undefined) || match?.title || "Chamado";
    const status = visit?.statusInterno ?? "unknown";

    const [customerHistory, contractHistory] = await Promise.all([
      this.listRelatedHistory({ customerId: row.customerId }, protocol),
      this.listRelatedHistory({ contractId: row.contractId }, protocol)
    ]);

    return {
      activityId: row.id,
      ticketId: (row.metadata?.ticketId as string | undefined) ?? null,
      protocol,
      customerId: row.customerId,
      customerName: row.customerName,
      cpfMasked: row.cpfMasked,
      sgpCustomerId: row.sgpCustomerId,
      contractId: row.contractId,
      title,
      openedAt: row.createdAt.toISOString(),
      updatedAt: visit?.updatedAt ?? row.createdAt.toISOString(),
      closedAt: status === "closed" ? visit?.updatedAt ?? null : null,
      status,
      statusLabel: STATUS_LABELS[status],
      statusRaw: visit?.status ?? null,
      description: match?.description || null,
      closureReason: visit?.closureReason ?? null,
      connectionStatus: visit?.connectionStatus,
      contract: contract ?? null,
      customerHistory,
      contractHistory
    };
  }

  async exportCsv(filters: Omit<TicketListFilters, "page" | "limit">): Promise<string> {
    const { rows, truncated } = await this.loadWindow(filters.range, {
      contractId: filters.contractId,
      customerId: filters.customerId,
      search: filters.search
    });

    if (truncated) {
      throw new AppError(
        422,
        "TICKET_EXPORT_TOO_LARGE",
        `O período selecionado tem mais de ${EXPORT_ROW_CAP} chamados. Estreite o período ou os filtros antes de exportar.`
      );
    }

    let items = await this.enrichRows(rows);
    if (filters.status) {
      items = items.filter((item) => item.status === filters.status);
    }
    items = sortItems(items, filters.sort);

    return toCsv(items);
  }

  private async countInRange(range: AnalyticsRange): Promise<number> {
    const result = await this.activityRepository.listActivity({
      range,
      page: 1,
      limit: 1,
      eventType: "OPEN_TICKET"
    });
    return result.total;
  }

  private async loadWindow(
    range: AnalyticsRange,
    scope: { contractId?: string | undefined; customerId?: string | undefined; search?: string | undefined }
  ): Promise<{ rows: ActivityLogEntry[]; truncated: boolean }> {
    const result = await this.activityRepository.listActivity({
      range,
      page: 1,
      limit: STATUS_ENRICH_ROW_CAP,
      eventType: "OPEN_TICKET",
      contractId: scope.contractId,
      customerId: scope.customerId,
      search: scope.search,
      order: "desc"
    });

    return { rows: result.items, truncated: result.total > STATUS_ENRICH_ROW_CAP };
  }

  private async listRelatedHistory(
    scope: { customerId?: string | undefined; contractId?: string | undefined },
    excludeProtocol: string
  ): Promise<AdminTicketListItem[]> {
    const result = await this.activityRepository.listActivity({
      range: ALL_TIME_RANGE,
      page: 1,
      limit: 50,
      eventType: "OPEN_TICKET",
      contractId: scope.contractId,
      customerId: scope.customerId,
      order: "desc"
    });

    const rows = result.items.filter((row) => (row.metadata?.protocol as string | undefined) !== excludeProtocol);
    return this.enrichRows(rows);
  }

  private async findActivityRowByProtocol(protocol: string): Promise<ActivityLogEntry | null> {
    const result = await this.activityRepository.listActivity({
      range: ALL_TIME_RANGE,
      page: 1,
      limit: 20,
      eventType: "OPEN_TICKET",
      search: protocol,
      order: "desc"
    });

    return result.items.find((row) => row.metadata?.protocol === protocol) ?? null;
  }

  private async enrichRows(rows: ActivityLogEntry[]): Promise<AdminTicketListItem[]> {
    const distinctContractIds = [...new Set(rows.map((row) => row.contractId).filter((id): id is string => Boolean(id)))];
    await Promise.all(distinctContractIds.map((contractId) => this.getContractOccurrences(contractId)));

    return rows.map((row) => {
      const protocol = (row.metadata?.protocol as string | undefined) ?? null;
      const cached = row.contractId ? this.contractOccurrenceCache.get(row.contractId) : undefined;
      const match = protocol ? cached?.items.find((occurrence) => occurrence.protocol === protocol) : undefined;
      const visit = match && row.contractId ? mapSgpOsToCustomerVisit(match.raw, row.contractId) : null;
      const status = visit?.statusInterno ?? "unknown";

      return {
        activityId: row.id,
        ticketId: (row.metadata?.ticketId as string | undefined) ?? null,
        protocol,
        customerId: row.customerId,
        customerName: row.customerName,
        cpfMasked: row.cpfMasked,
        sgpCustomerId: row.sgpCustomerId,
        contractId: row.contractId,
        title: (row.metadata?.title as string | undefined) || "Chamado",
        openedAt: row.createdAt.toISOString(),
        updatedAt: visit?.updatedAt ?? row.createdAt.toISOString(),
        status,
        statusLabel: STATUS_LABELS[status],
        statusRaw: visit?.status ?? null
      };
    });
  }

  private async getContractOccurrences(contractId: string): Promise<TicketSummaryWithRaw[]> {
    const cached = this.contractOccurrenceCache.get(contractId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.items;
    }

    let items: TicketSummaryWithRaw[] = [];
    try {
      items = (await this.ticketProvider.listOccurrencesByContract(contractId)) as TicketSummaryWithRaw[];
    } catch {
      items = [];
    }

    this.contractOccurrenceCache.set(contractId, { expiresAt: Date.now() + SGP_CACHE_TTL_MS, items });
    return items;
  }
}

function sortItems(items: AdminTicketListItem[], sort: TicketListFilters["sort"]): AdminTicketListItem[] {
  const [field, direction] = sort.startsWith("updatedAt") ? ["updatedAt" as const, sort] : ["openedAt" as const, sort];
  const ascending = direction.endsWith("asc");

  return [...items].sort((a, b) => {
    const left = new Date(a[field]).getTime();
    const right = new Date(b[field]).getTime();
    return ascending ? left - right : right - left;
  });
}

function todayRange(): AnalyticsRange {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

function daysAgoRange(days: number): AnalyticsRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to };
}

const CSV_COLUMNS: Array<{ key: keyof AdminTicketListItem; label: string }> = [
  { key: "protocol", label: "Protocolo" },
  { key: "customerName", label: "Cliente" },
  { key: "cpfMasked", label: "CPF" },
  { key: "sgpCustomerId", label: "ID Cliente SGP" },
  { key: "contractId", label: "Contrato" },
  { key: "title", label: "Motivo" },
  { key: "statusLabel", label: "Status" },
  { key: "openedAt", label: "Aberto em" },
  { key: "updatedAt", label: "Atualizado em" }
];

function toCsv(items: AdminTicketListItem[]): string {
  const header = CSV_COLUMNS.map((column) => escapeCsvCell(column.label)).join(";");
  const lines = items.map((item) => CSV_COLUMNS.map((column) => escapeCsvCell(String(item[column.key] ?? ""))).join(";"));
  return [header, ...lines].join("\r\n");
}

/** Escapa aspas (CSV padrao) e neutraliza formulas (=, +, -, @ no inicio -- CSV injection classico ao abrir no Excel/Sheets). */
function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[";\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
