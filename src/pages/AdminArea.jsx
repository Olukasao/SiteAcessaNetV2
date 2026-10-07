import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
	  BarChart3,
	  Bell,
	  Bug,
	  Copy,
  Download,
  Eye,
  Headset,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Monitor,
  Trash2,
  Users
} from "lucide-react";
import {
  AdminApiError,
  adminLogin,
  adminLogout,
  adminMe,
  createNotice,
  deleteNotice,
  duplicateNotice,
  exportChamadosCsv,
  getChamadoDetail,
  getChamadosSummary,
  getNotice,
  getNoticeHistory,
  getAnalyticsClient,
	  getAnalyticsOverview,
	  getBugReport,
	  getBugReportsSummary,
	  getCentralAnalytics,
  listAnalyticsActivity,
	  listAnalyticsClients,
	  listAnalyticsEvents,
	  listBugReports,
	  listChamados,
	  listNotices,
	  readAdminTokens,
	  setNoticeActive,
	  updateBugReport,
	  updateNotice
} from "../services/adminApi";
import NoticeBanner from "../components/central/NoticeBanner";
import NoticeCard from "../components/central/NoticeCard";
import NoticeModal from "../components/central/NoticeModal";
import "../styles/clienteArea.css";
import "../styles/components-styles/centralNotices.css";
import "../styles/admin/adminArea.css";

const TYPE_LABELS = {
  informativo: "Informativo",
  atencao: "Atenção",
  urgente: "Urgente",
  sucesso: "Sucesso",
  manutencao: "Manutenção",
  instabilidade: "Instabilidade"
};

const DISPLAY_LABELS = { banner: "Banner", modal: "Modal", card: "Card" };
const PRIORITY_LABELS = { baixa: "Baixa", normal: "Normal", alta: "Alta", critica: "Crítica" };
const FREQUENCY_LABELS = {
  always: "Sempre",
  once_per_session: "Uma vez por sessão",
  once_per_customer: "Uma vez por cliente"
};
const AUDIENCE_TYPE_LABELS = {
  all: "Todos os clientes",
  contract: "Contratos específicos",
  customer: "Clientes específicos",
  plan: "Plano específico",
  city: "Cidade",
  state: "Estado",
  contract_status: "Status do contrato"
};

const ADMIN_SECTIONS = [
  { key: "overview", path: "/admin", label: "Visão Geral", icon: LayoutDashboard },
  { key: "notices", path: "/admin/avisos", label: "Avisos", icon: Bell },
  { key: "bugs", path: "/admin/bugs", label: "Bugs relatados", icon: Bug },
  { key: "chamados", path: "/admin/chamados", label: "Chamados", icon: Headset },
  { key: "central", path: "/admin/central", label: "Central", icon: BarChart3 },
  { key: "clients", path: "/admin/clientes", label: "Clientes", icon: Users },
  { key: "activity", path: "/admin/historico", label: "Histórico", icon: Activity }
];

const BUG_REPORT_CATEGORIES = [
  "Dados incorretos",
  "Status da conexão",
  "Faturas / boletos",
  "Contratos",
  "Chamados",
  "Login",
  "Interface / visual",
  "Lentidão",
  "Erro ao carregar página",
  "Outro"
];

const BUG_REPORT_STATUSES = [
  { value: "", label: "Todos" },
  { value: "novo", label: "Novos" },
  { value: "analisando", label: "Em análise" },
  { value: "corrigido", label: "Corrigidos" },
  { value: "ignorado", label: "Ignorados" }
];

const BUG_REPORT_STATUS_LABELS = {
  novo: "Novo",
  analisando: "Em análise",
  corrigido: "Corrigido",
  ignorado: "Ignorado"
};

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "custom", label: "Personalizado" }
];

const EVENT_LABELS = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  VIEW_HOME: "Início",
  VIEW_CONTRACTS: "Contratos",
  SELECT_CONTRACT: "Contrato selecionado",
  VIEW_INVOICES: "Faturas",
  VIEW_BILLING: "Resumo financeiro",
  VIEW_PLAN: "Plano",
  VIEW_CONNECTION: "Conexão",
  VIEW_TICKETS: "Chamados",
  VIEW_TICKET_DETAIL: "Detalhe do chamado",
  OPEN_TICKET: "Chamado aberto",
  REQUEST_PAYMENT_PROMISE: "Promessa de pagamento",
  VIEW_NOTICES: "Avisos",
  VIEW_NETWORK_STATUS: "Status regional",
  VIEW_SIGNATURES: "Assinaturas",
  SIGNATURE_EVENT: "Evento de assinatura",
  CHANGE_PASSWORD: "Senha alterada",
  DOWNLOAD_INVOICE: "2ª via",
  GENERATE_PIX: "PIX",
  CUSTOM: "Evento"
};

/** Espelho so-de-leitura do mapa real (server/src/auth/adminPermissions.ts) -- so pra esconder/desabilitar botao na UI; o backend sempre revalida de verdade. */
const ROLE_PERMISSIONS = {
  admin: ["avisos.read", "avisos.create", "avisos.update", "avisos.delete", "avisos.publish"],
  editor: ["avisos.read", "avisos.create", "avisos.update", "avisos.publish"],
  viewer: ["avisos.read"]
};

function can(admin, permission) {
  return Boolean(admin && ROLE_PERMISSIONS[admin.role]?.includes(permission));
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatDuration(seconds) {
  if (!seconds) return "—";
  const minutes = Math.round(Number(seconds) / 60);
  if (minutes < 1) return `${Math.round(Number(seconds))}s`;
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${rest ? ` ${rest}min` : ""}`;
}

function eventLabel(value) {
  return EVENT_LABELS[value] || value || "Evento";
}

function pageTitle(pageKey) {
  const labels = {
    overview: "Visão Geral",
	    notices: "Avisos",
	    new: "Novo aviso",
	    edit: "Editar aviso",
	    bugs: "Bugs relatados",
	    chamados: "Chamados",
	    central: "Central do Assinante",
    clients: "Clientes",
    activity: "Histórico de Atividades"
  };
  return labels[pageKey] || "Admin AcessaNet";
}

function getPageKey(pathname) {
  if (pathname === "/admin/login") return "login";
  if (pathname === "/admin" || pathname === "/admin/") return "overview";
	  if (pathname === "/admin/central") return "central";
	  if (pathname === "/admin/clientes") return "clients";
	  if (pathname === "/admin/historico") return "activity";
	  if (pathname === "/admin/bugs") return "bugs";
	  if (pathname === "/admin/chamados") return "chamados";
	  if (pathname === "/admin/avisos") return "notices";
  if (pathname === "/admin/avisos/novo") return "new";
  const editMatch = /^\/admin\/avisos\/([^/]+)$/.exec(pathname);
  if (editMatch) return { key: "edit", id: editMatch[1] };
  return "overview";
}

export default function AdminArea() {
  const navigate = useNavigate();
	  const location = useLocation();
	  const [bootstrapping, setBootstrapping] = useState(true);
	  const [admin, setAdmin] = useState(null);
	  const [bugNewCount, setBugNewCount] = useState(0);

  useEffect(() => {
    document.body.classList.add("cliente-area-shell");
    return () => document.body.classList.remove("cliente-area-shell");
  }, []);

	  useEffect(() => {
	    async function bootstrap() {
      const { accessToken } = readAdminTokens();
      if (!accessToken) {
        setBootstrapping(false);
        return;
      }
      try {
        const me = await adminMe();
        setAdmin(me);
      } catch {
        setAdmin(null);
      } finally {
        setBootstrapping(false);
      }
    }
	    void bootstrap();
	  }, []);

	  const refreshBugSummary = useCallback(async () => {
	    try {
	      const summary = await getBugReportsSummary();
	      setBugNewCount(Number(summary.newCount || 0));
	    } catch {
	      setBugNewCount(0);
	    }
	  }, []);

	  useEffect(() => {
	    if (admin) {
	      void refreshBugSummary();
	    }
	  }, [admin, refreshBugSummary]);

  async function handleLogout() {
    await adminLogout().catch(() => {});
    setAdmin(null);
    navigate("/admin/login", { replace: true });
  }

  if (bootstrapping) {
    return <div className="admin-loading-screen">Carregando painel administrativo…</div>;
  }

  if (!admin) {
    return <AdminLogin onAuthenticated={setAdmin} />;
  }

  const pageInfo = getPageKey(location.pathname);
  const pageKey = typeof pageInfo === "string" ? pageInfo : pageInfo.key;
  const editingId = typeof pageInfo === "object" ? pageInfo.id : null;

  return (
    <div className="admin-shell">
      <Helmet>
        <title>{pageTitle(pageKey)} | Admin AcessaNet</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <ShieldCheck size={20} />
          <span>Admin AcessaNet</span>
        </div>
        <div className="admin-topbar-user">
          <span>
            {admin.name} <small>({admin.role})</small>
          </span>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <nav className="admin-nav" aria-label="Navegação administrativa">
            {ADMIN_SECTIONS.map((section) => {
              const activeKey = pageKey === "new" || pageKey === "edit" ? "notices" : pageKey;
              const Icon = section.icon;
              return (
                <button
                  className={`admin-nav-item ${activeKey === section.key ? "is-active" : ""}`}
                  key={section.key}
                  onClick={() => navigate(section.path)}
                  type="button"
                >
	                  <Icon size={18} />
	                  <span>{section.label}</span>
	                  {section.key === "bugs" && bugNewCount > 0 ? <em className="admin-nav-badge">{bugNewCount}</em> : null}
	                </button>
              );
            })}
          </nav>
        </aside>

        <main className="admin-content">
          {pageKey === "overview" ? (
            <OverviewPage />
          ) : pageKey === "notices" ? (
            <NoticesListPage admin={admin} onNavigate={navigate} />
          ) : pageKey === "new" ? (
            <NoticeFormPage admin={admin} mode="create" onNavigate={navigate} />
          ) : pageKey === "edit" ? (
            <NoticeFormPage admin={admin} mode="edit" noticeId={editingId} onNavigate={navigate} />
	          ) : pageKey === "central" ? (
	            <CentralStatsPage />
	          ) : pageKey === "bugs" ? (
	            <BugReportsPage onChanged={refreshBugSummary} />
	          ) : pageKey === "chamados" ? (
	            <ChamadosPage />
	          ) : pageKey === "clients" ? (
            <ClientsPage />
          ) : pageKey === "activity" ? (
            <ActivityHistoryPage />
          ) : (
            <OverviewPage />
          )}
        </main>
      </div>
    </div>
  );
}

function OverviewPage() {
  const [period, setPeriod] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => ({ period, ...(period === "custom" ? { from, to } : {}) }), [from, period, to]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getAnalyticsOverview(params);
        if (active) setData(result);
      } catch (caughtError) {
        if (active) setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar as métricas.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params]);

  const cards = [
    ["Acessos hoje", data?.cards?.accessesToday],
    ["Clientes únicos hoje", data?.cards?.uniqueClientsToday],
    ["Únicos 7 dias", data?.cards?.uniqueClients7d],
    ["Únicos 30 dias", data?.cards?.uniqueClients30d],
    ["Total de sessões", data?.cards?.totalSessions],
    ["Chamados pela Central", data?.cards?.ticketsOpened],
    ["2ª vias geradas", data?.cards?.secondCopiesGenerated],
    ["Consultas de faturas", data?.cards?.invoiceQueries],
    ["Consultas de conexão", data?.cards?.connectionQueries]
  ];

  return (
    <div className="admin-page-stack">
      <PageHeader title="Visão Geral" period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <InlineState loading={loading} error={error} />
      {data ? (
        <>
          <MetricGrid items={cards} />
          <div className="admin-dashboard-grid">
            <ChartPanel title="Acessos por dia" items={data.charts?.accessesByDay} />
            <ChartPanel title="Acessos por hora" items={data.charts?.accessesByHour} />
            <ChartPanel title="Eventos mais usados" items={data.charts?.events} />
            <ChartPanel title="Mobile x desktop" items={data.charts?.devices} />
          </div>
          <RecentActivityPanel items={data.recentActivity} />
        </>
      ) : null}
    </div>
  );
}

function CentralStatsPage() {
  const [period, setPeriod] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const params = useMemo(() => ({ period, ...(period === "custom" ? { from, to } : {}) }), [from, period, to]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getCentralAnalytics(params);
        if (active) setData(result);
      } catch (caughtError) {
        if (active) setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar a Central.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params]);

  const cards = [
    ["Acessos totais", data?.totals?.accesses],
    ["Clientes únicos", data?.totals?.uniqueClients],
    ["Sessões", data?.totals?.sessions],
    ["Clientes retornaram", data?.totals?.returningClients],
    ["Novos usuários", data?.totals?.newClients],
    ["Duração média", formatDuration(data?.totals?.averageSessionSeconds)]
  ];

  return (
    <div className="admin-page-stack">
      <PageHeader title="Central do Assinante" period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <InlineState loading={loading} error={error} />
      {data ? (
        <>
          <MetricGrid items={cards} />
          <div className="admin-dashboard-grid">
            <ChartPanel title="Clientes únicos por dia" items={data.charts?.uniqueClientsByDay} />
            <ChartPanel title="Páginas mais acessadas" items={data.charts?.pages} />
            <ChartPanel title="Funcionalidades" items={data.charts?.events} />
            <ChartPanel title="Dispositivos" items={data.charts?.devices} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function bugStatusLabel(value) {
  return BUG_REPORT_STATUS_LABELS[value] || value || "—";
}

function BugStatusPill({ status }) {
  return <span className={`admin-status-pill tone-${status || "novo"}`}>{bugStatusLabel(status)}</span>;
}

function BugReportsPage({ onChanged }) {
  const [status, setStatus] = useState("novo");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [contractId, setContractId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(
    () => ({
      page,
      limit: 30,
      status,
      category,
      search,
      customer,
      contractId,
      from,
      to
    }),
    [category, contractId, customer, from, page, search, status, to]
  );

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listBugReports(params);
      setData(result);
      await onChanged?.();
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar os relatórios.");
    } finally {
      setLoading(false);
    }
  }, [onChanged, params]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function openReport(report) {
    setSelected({ loading: true, report, history: [] });
    try {
      const result = await getBugReport(report.id);
      setSelected({ loading: false, report: result.report, history: result.history || [] });
    } catch (caughtError) {
      setSelected({
        loading: false,
        report,
        history: [],
        error: caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar o relatório."
      });
    }
  }

  function resetFilters() {
    setStatus("");
    setCategory("");
    setSearch("");
    setCustomer("");
    setContractId("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Bugs relatados</h2>
      </div>
      <FilterBar>
        <label className="admin-field admin-field-inline">
          <span>Status</span>
          <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
            {BUG_REPORT_STATUSES.map((item) => <option value={item.value} key={item.value || "all"}>{item.label}</option>)}
          </select>
        </label>
        <label className="admin-field admin-field-inline">
          <span>Categoria</span>
          <select value={category} onChange={(event) => { setPage(1); setCategory(event.target.value); }}>
            <option value="">Todas</option>
            {BUG_REPORT_CATEGORIES.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>
        <label className="admin-field admin-field-inline">
          <span>Busca</span>
          <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Cliente, relatório, contrato..." />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Cliente</span>
          <input value={customer} onChange={(event) => { setPage(1); setCustomer(event.target.value); }} />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Contrato</span>
          <input value={contractId} onChange={(event) => { setPage(1); setContractId(event.target.value); }} />
        </label>
        <label className="admin-field admin-field-inline">
          <span>De</span>
          <input type="date" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Até</span>
          <input type="date" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} />
        </label>
        <button type="button" className="admin-btn admin-btn-soft" onClick={resetFilters}>Limpar</button>
      </FilterBar>
      <InlineState loading={loading} error={error} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>CPF</th>
              <th>Contrato</th>
              <th>Categoria</th>
              <th>Página</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((report) => (
              <tr key={report.id} onClick={() => openReport(report)}>
                <td>#{report.id}</td>
                <td>{report.customerName || report.sgpCustomerId || report.customerId}</td>
                <td>{report.cpfMasked || "—"}</td>
                <td>{report.contractId || "—"}</td>
                <td>{report.category}</td>
                <td>{report.page || "—"}</td>
                <td><BugStatusPill status={report.status} /></td>
                <td>{formatDateTime(report.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager data={data} page={page} setPage={setPage} />
	      {selected ? (
	        <BugReportDetailModal
	          state={selected}
	          onClose={() => setSelected(null)}
	          onUpdated={(next) => {
	            setSelected((current) => ({ ...(current || {}), loading: false, report: next.report, history: next.history || [] }));
	            setData((current) => current ? { ...current, items: current.items.map((item) => item.id === next.report.id ? next.report : item) } : current);
	            void onChanged?.();
	          }}
	        />
	      ) : null}
    </div>
  );
}

function ClientsPage() {
  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const [contractId, setContractId] = useState("");
  const [eventType, setEventType] = useState("");
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void listAnalyticsEvents().then((result) => setEvents(result.events || [])).catch(() => setEvents([]));
  }, []);

  const params = useMemo(() => ({ period, page, limit: 20, search, contractId, eventType }), [contractId, eventType, page, period, search]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await listAnalyticsClients(params);
        if (active) setData(result);
      } catch (caughtError) {
        if (active) setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar clientes.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params]);

  async function openClient(client) {
    setSelected({ loading: true, client });
    try {
      const result = await getAnalyticsClient(client.customerId, { period });
      setSelected({ loading: false, client: result.client || client });
    } catch (caughtError) {
      setSelected({ loading: false, client, error: caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar o cliente." });
    }
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Clientes</h2>
        <PeriodControl period={period} setPeriod={setPeriod} />
      </div>
      <FilterBar>
        <label className="admin-field admin-field-inline">
          <span>Busca</span>
          <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Nome, CPF, ID ou contrato" />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Contrato</span>
          <input value={contractId} onChange={(event) => { setPage(1); setContractId(event.target.value); }} />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Evento</span>
          <select value={eventType} onChange={(event) => { setPage(1); setEventType(event.target.value); }}>
            <option value="">Todos</option>
            {events.map((event) => <option value={event} key={event}>{eventLabel(event)}</option>)}
          </select>
        </label>
      </FilterBar>
      <InlineState loading={loading} error={error} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>CPF/CNPJ</th>
              <th>Cliente ID</th>
              <th>Contrato</th>
              <th>Primeiro acesso</th>
              <th>Último acesso</th>
              <th>Acessos</th>
              <th>Última atividade</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((client) => (
              <tr key={client.customerId} onClick={() => openClient(client)}>
                <td>{client.customerName || "Cliente"}</td>
                <td>{client.cpfMasked || "—"}</td>
                <td>{client.sgpCustomerId || client.customerId}</td>
                <td>{client.contracts?.join(", ") || "—"}</td>
                <td>{formatDateTime(client.firstAccessAt)}</td>
                <td>{formatDateTime(client.lastAccessAt)}</td>
                <td>{formatNumber(client.accessCount)}</td>
                <td>{eventLabel(client.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager data={data} page={page} setPage={setPage} />
      {selected ? <ClientDetailModal state={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function ActivityHistoryPage() {
  const [period, setPeriod] = useState("7d");
  const [customer, setCustomer] = useState("");
  const [contractId, setContractId] = useState("");
  const [eventType, setEventType] = useState("");
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void listAnalyticsEvents().then((result) => setEvents(result.events || [])).catch(() => setEvents([]));
  }, []);

  const params = useMemo(() => ({ period, page, limit: 30, customer, contractId, eventType }), [contractId, customer, eventType, page, period]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await listAnalyticsActivity(params);
        if (active) setData(result);
      } catch (caughtError) {
        if (active) setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar atividades.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params]);

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Histórico de Atividades</h2>
        <PeriodControl period={period} setPeriod={setPeriod} />
      </div>
      <FilterBar>
        <label className="admin-field admin-field-inline">
          <span>Cliente</span>
          <input value={customer} onChange={(event) => { setPage(1); setCustomer(event.target.value); }} />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Contrato</span>
          <input value={contractId} onChange={(event) => { setPage(1); setContractId(event.target.value); }} />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Evento</span>
          <select value={eventType} onChange={(event) => { setPage(1); setEventType(event.target.value); }}>
            <option value="">Todos</option>
            {events.map((event) => <option value={event} key={event}>{eventLabel(event)}</option>)}
          </select>
        </label>
      </FilterBar>
      <InlineState loading={loading} error={error} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Contrato</th>
              <th>Evento</th>
              <th>Página</th>
              <th>Dispositivo</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((item) => (
              <tr key={item.id} onClick={() => setSelected(item)}>
                <td>{formatDateTime(item.createdAt)}</td>
                <td>{item.customerName || item.sgpCustomerId || item.customerId}</td>
                <td>{item.contractId || "—"}</td>
                <td>{eventLabel(item.eventType)}</td>
                <td>{item.page || "—"}</td>
                <td>{item.deviceType || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager data={data} page={page} setPage={setPage} />
      {selected ? <ActivityDetailModal activity={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

const CHAMADO_STATUS_LABELS = {
  open: "Aberto",
  scheduled: "Agendado",
  in_progress: "Em atendimento",
  closed: "Encerrado",
  unknown: "Indisponível"
};

const CHAMADO_STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "open", label: "Aberto" },
  { value: "scheduled", label: "Agendado" },
  { value: "in_progress", label: "Em atendimento" },
  { value: "closed", label: "Encerrado" }
];

const CHAMADO_PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "custom", label: "Personalizado" }
];

const CHAMADO_SORT_OPTIONS = [
  { value: "createdAt_desc", label: "Mais recentes" },
  { value: "createdAt_asc", label: "Mais antigos" },
  { value: "updatedAt_desc", label: "Última atualização" }
];

function ChamadoStatusPill({ status }) {
  return <span className={`admin-status-pill tone-chamado-${status || "unknown"}`}>{CHAMADO_STATUS_LABELS[status] || "—"}</span>;
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function formatElapsed(fromIso) {
  if (!fromIso) return "—";
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - start) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Le-somente: espelha os chamados abertos via Central do Assinante
 * (server/src/support/adminTicketService.ts), enriquecidos ao vivo com o
 * status real do SGP. Sem prioridade/responsavel/notas internas/acoes de
 * workflow -- esses conceitos nao existem hoje no sistema (esse fluxo
 * acontece inteiramente dentro do SGP, por atendentes humanos), entao nao
 * sao inventados aqui.
 */
function ChamadosPage() {
  const [period, setPeriod] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt_desc");
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const periodParams = useMemo(() => ({ period, ...(period === "custom" ? { from, to } : {}) }), [from, period, to]);
  const listParams = useMemo(
    () => ({ ...periodParams, page, limit, search: debouncedSearch, status, sort }),
    [debouncedSearch, limit, page, periodParams, sort, status]
  );

  const loadSummary = useCallback(async () => {
    try {
      const result = await getChamadosSummary(periodParams);
      setSummary(result);
    } catch {
      setSummary(null);
    }
  }, [periodParams]);

  const loadList = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const result = await listChamados(listParams);
        setData(result);
      } catch (caughtError) {
        setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar os chamados.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [listParams]
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  /** Sem WebSocket/SSE no projeto -- cobre a necessidade de dado "ao vivo" com um refetch periodico leve, so quando a aba esta visivel. */
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadList({ silent: true });
        void loadSummary();
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [loadList, loadSummary]);

  function handleCardClick(nextStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      await exportChamadosCsv(listParams);
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível exportar os chamados.");
    } finally {
      setExporting(false);
    }
  }

  const cards = [
    { label: "Total", value: summary?.total, statusValue: "" },
    { label: "Abertos hoje", value: summary?.openedToday, statusValue: "" },
    { label: "Últimos 7 dias", value: summary?.opened7d, statusValue: "" },
    { label: "Aberto", value: summary?.byStatus?.open, statusValue: "open" },
    { label: "Agendado", value: summary?.byStatus?.scheduled, statusValue: "scheduled" },
    { label: "Em atendimento", value: summary?.byStatus?.in_progress, statusValue: "in_progress" },
    { label: "Encerrado", value: summary?.byStatus?.closed, statusValue: "closed" }
  ];

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Chamados</h2>
        <div className="admin-page-head-actions">
          <button
            type="button"
            className="admin-btn admin-btn-soft"
            onClick={() => {
              void loadList();
              void loadSummary();
            }}
          >
            <RefreshCw size={15} />
            Atualizar
          </button>
          <button type="button" className="admin-btn admin-btn-soft" disabled={exporting} onClick={handleExport}>
            <Download size={15} />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </button>
        </div>
      </div>

      {summary?.truncated ? (
        <div className="admin-inline-notice tone-warning">
          <AlertTriangle size={16} />
          <span>
            O período selecionado tem muitos chamados — a quebra por status abaixo considera só uma amostra recente. Estreite o
            período para um número exato.
          </span>
        </div>
      ) : null}

      <div className="admin-metric-grid admin-metric-grid-clickable">
        {cards.map((card) => (
          <button
            type="button"
            key={card.label}
            className={`admin-metric admin-metric-button ${status === card.statusValue ? "is-active" : ""}`}
            onClick={() => handleCardClick(card.statusValue)}
          >
            <span>{card.label}</span>
            <strong>{formatNumber(card.value)}</strong>
          </button>
        ))}
      </div>

      <FilterBar>
        <label className="admin-field admin-field-inline">
          <span>Busca</span>
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Protocolo, cliente, CPF, contrato, motivo..."
          />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            {CHAMADO_STATUS_OPTIONS.map((item) => (
              <option value={item.value} key={item.value || "all"}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field admin-field-inline">
          <span>Ordenar por</span>
          <select
            value={sort}
            onChange={(event) => {
              setPage(1);
              setSort(event.target.value);
            }}
          >
            {CHAMADO_SORT_OPTIONS.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field admin-field-inline">
          <span>Por página</span>
          <select
            value={limit}
            onChange={(event) => {
              setPage(1);
              setLimit(Number(event.target.value));
            }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </FilterBar>

      <PeriodControlExtended period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />

      <InlineState loading={loading} error={error} />

      {data && !loading && data.items.length === 0 ? (
        <p className="admin-muted">Nenhum chamado encontrado com os filtros selecionados.</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>Contrato</th>
                  <th>Motivo</th>
                  <th>Status</th>
                  <th>Aberto em</th>
                  <th>Atualizado em</th>
                  <th>Tempo em aberto</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.activityId} onClick={() => setSelectedProtocol(item.protocol)}>
                    <td>{item.protocol || "—"}</td>
                    <td>{item.customerName || item.sgpCustomerId || item.customerId}</td>
                    <td>{item.cpfMasked || "—"}</td>
                    <td>{item.contractId || "—"}</td>
                    <td>{item.title}</td>
                    <td>
                      <ChamadoStatusPill status={item.status} />
                    </td>
                    <td>{formatDateTime(item.openedAt)}</td>
                    <td>{formatDateTime(item.updatedAt)}</td>
                    <td>{item.status === "closed" ? "—" : formatElapsed(item.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager data={data} page={page} setPage={setPage} />
          {data.truncated ? (
            <p className="admin-muted">
              Há mais chamados no período do que o filtro por status/ordenação consegue processar de uma vez — estreite o
              período para ver todos.
            </p>
          ) : null}
        </>
      ) : null}

      {selectedProtocol ? <ChamadoDetailDialog protocol={selectedProtocol} onClose={() => setSelectedProtocol(null)} /> : null}
    </div>
  );
}

function PeriodControlExtended({ period, setPeriod, from, setFrom, to, setTo }) {
  return (
    <div className="admin-period-control">
      {CHAMADO_PERIOD_OPTIONS.map((option) => (
        <button className={period === option.value ? "is-active" : ""} key={option.value} onClick={() => setPeriod(option.value)} type="button">
          {option.label}
        </button>
      ))}
      {period === "custom" ? (
        <>
          <input type="date" value={from || ""} onChange={(event) => setFrom(event.target.value)} />
          <input type="date" value={to || ""} onChange={(event) => setTo(event.target.value)} />
        </>
      ) : null}
    </div>
  );
}

function ChamadoDetailDialog({ protocol, onClose }) {
  const [state, setState] = useState({ loading: true, detail: null, error: "" });

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ loading: true, detail: null, error: "" });
    getChamadoDetail(protocol)
      .then((detail) => {
        if (active) setState({ loading: false, detail, error: "" });
      })
      .catch((caughtError) => {
        if (active) {
          setState({
            loading: false,
            detail: null,
            error: caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar o chamado."
          });
        }
      });
    return () => {
      active = false;
    };
  }, [protocol]);

  const detail = state.detail;

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-dialog admin-dialog-wide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>Chamado {protocol}</h3>
        {state.error ? <p className="admin-muted">{state.error}</p> : null}
        {state.loading ? <p className="admin-muted">Carregando…</p> : null}

        {detail ? (
          <>
            <dl className="admin-detail-grid">
              <div>
                <dt>Protocolo</dt>
                <dd>{detail.protocol}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <ChamadoStatusPill status={detail.status} />
                </dd>
              </div>
              <div>
                <dt>Aberto em</dt>
                <dd>{formatDateTime(detail.openedAt)}</dd>
              </div>
              <div>
                <dt>Atualizado em</dt>
                <dd>{formatDateTime(detail.updatedAt)}</dd>
              </div>
              {detail.closedAt ? (
                <div>
                  <dt>Encerrado em</dt>
                  <dd>{formatDateTime(detail.closedAt)}</dd>
                </div>
              ) : null}
            </dl>

            <h4>Cliente</h4>
            <dl className="admin-detail-grid">
              <div>
                <dt>Nome</dt>
                <dd>{detail.customerName || "—"}</dd>
              </div>
              <div>
                <dt>CPF</dt>
                <dd>{detail.cpfMasked || "—"}</dd>
              </div>
              <div>
                <dt>ID no SGP</dt>
                <dd>{detail.sgpCustomerId || "—"}</dd>
              </div>
            </dl>

            <h4>Contrato</h4>
            <dl className="admin-detail-grid">
              <div>
                <dt>Número</dt>
                <dd>{detail.contractId}</dd>
              </div>
              <div>
                <dt>Plano</dt>
                <dd>{detail.contract?.planName || "—"}</dd>
              </div>
              <div>
                <dt>Endereço</dt>
                <dd>
                  {detail.contract?.addressLine || "—"}
                  {detail.contract?.city ? `, ${detail.contract.city}/${detail.contract.state}` : ""}
                </dd>
              </div>
              <div>
                <dt>Status contratual</dt>
                <dd>
                  {detail.contract?.status || "—"}{" "}
                  <small className="admin-muted">(diferente do status do chamado/conexão acima)</small>
                </dd>
              </div>
            </dl>

            <h4>Descrição do problema</h4>
            <p className="admin-chamado-description">{detail.description || "Sem descrição disponível."}</p>

            {detail.closureReason ? (
              <>
                <h4>Motivo do encerramento</h4>
                <p className="admin-chamado-description">{detail.closureReason}</p>
              </>
            ) : null}

            {detail.customerHistory?.length ? (
              <>
                <h4>Outros chamados deste cliente</h4>
                <MiniChamadoList items={detail.customerHistory} />
              </>
            ) : null}

            {detail.contractHistory?.length ? (
              <>
                <h4>Chamados deste contrato</h4>
                <MiniChamadoList items={detail.contractHistory} />
              </>
            ) : null}
          </>
        ) : null}

        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniChamadoList({ items }) {
  return (
    <ul className="admin-history-list">
      {items.map((item) => (
        <li key={item.activityId}>
          <strong>{item.protocol}</strong>
          <span>
            {item.title} • <ChamadoStatusPill status={item.status} /> • {formatDateTime(item.openedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PageHeader({ title, period, setPeriod, from, setFrom, to, setTo }) {
  return (
    <div className="admin-page-head">
      <h2>{title}</h2>
      <PeriodControl period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />
    </div>
  );
}

function PeriodControl({ period, setPeriod, from, setFrom, to, setTo }) {
  return (
    <div className="admin-period-control">
      {PERIOD_OPTIONS.map((option) => (
        <button className={period === option.value ? "is-active" : ""} key={option.value} onClick={() => setPeriod(option.value)} type="button">
          {option.label}
        </button>
      ))}
      {period === "custom" && setFrom && setTo ? (
        <>
          <input type="date" value={from || ""} onChange={(event) => setFrom(event.target.value)} />
          <input type="date" value={to || ""} onChange={(event) => setTo(event.target.value)} />
        </>
      ) : null}
    </div>
  );
}

function InlineState({ loading, error }) {
  if (error) {
    return (
      <div className="admin-inline-notice tone-danger">
        <AlertTriangle size={16} />
        <span>{error}</span>
      </div>
    );
  }
  if (loading) return <p className="admin-muted">Carregando…</p>;
  return null;
}

function MetricGrid({ items }) {
  return (
    <div className="admin-metric-grid">
      {items.map(([label, value]) => (
        <div className="admin-metric" key={label}>
          <span>{label}</span>
          <strong>{typeof value === "string" ? value : formatNumber(value)}</strong>
        </div>
      ))}
    </div>
  );
}

/** Rotulos de grafico agrupados por dia vem do backend como "YYYY-MM-DD" (substr direto do created_at ISO) -- aqui exibidos em pt-BR (DD/MM/YYYY). Rotulos que nao batem esse formato (hora, evento, pagina, dispositivo) passam direto. */
function formatDayLabel(label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label || "");
  if (!match) return label;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function ChartPanel({ title, items = [] }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1);
  return (
    <section className="admin-panel">
      <h3>{title}</h3>
      {items.length ? (
        <div className="admin-bar-list">
          {items.map((item) => (
            <div className="admin-bar-row" key={`${title}-${item.label}`}>
              <span>{formatDayLabel(item.label)}</span>
              <div className="admin-bar-track">
                <i style={{ width: `${Math.max(6, (Number(item.value || 0) / max) * 100)}%` }} />
              </div>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="admin-muted">Sem dados.</p>
      )}
    </section>
  );
}

function RecentActivityPanel({ items = [] }) {
  return (
    <section className="admin-panel">
      <h3>Atividade recente</h3>
      <div className="admin-activity-list">
        {items.length ? (
          items.map((item) => (
            <button type="button" className="admin-activity-item" key={item.id}>
              <span>{formatDateTime(item.createdAt)}</span>
              <strong>{item.customerName || item.sgpCustomerId || item.customerId}</strong>
              <em>{eventLabel(item.eventType)}</em>
            </button>
          ))
        ) : (
          <p className="admin-muted">Sem atividade no período.</p>
        )}
      </div>
    </section>
  );
}

function FilterBar({ children }) {
  return (
    <div className="admin-filter-bar">
      <Search size={18} />
      {children}
    </div>
  );
}

function TablePager({ data, page, setPage }) {
  const total = Number(data?.total || 0);
  const limit = Number(data?.limit || 1);
  const maxPage = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="admin-table-pager">
      <span>{formatNumber(total)} registros</span>
      <div>
        <button className="admin-btn admin-btn-soft" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
          Anterior
        </button>
        <span>
          {page}/{maxPage}
        </span>
        <button className="admin-btn admin-btn-soft" disabled={page >= maxPage} onClick={() => setPage((value) => value + 1)} type="button">
          Próxima
        </button>
      </div>
    </div>
  );
}

function ClientDetailModal({ state, onClose }) {
  const client = state.client;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-dialog admin-dialog-wide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>{client.customerName || "Cliente"}</h3>
        {state.error ? <p className="admin-muted">{state.error}</p> : null}
        {state.loading ? <p className="admin-muted">Carregando…</p> : (
          <>
            <dl className="admin-detail-grid">
              <div><dt>Cliente ID</dt><dd>{client.sgpCustomerId || client.customerId}</dd></div>
              <div><dt>CPF</dt><dd>{client.cpfMasked || "—"}</dd></div>
              <div><dt>Contratos</dt><dd>{client.contracts?.join(", ") || "—"}</dd></div>
              <div><dt>Primeiro acesso</dt><dd>{formatDateTime(client.firstAccessAt)}</dd></div>
              <div><dt>Último acesso</dt><dd>{formatDateTime(client.lastAccessAt)}</dd></div>
              <div><dt>Sessões</dt><dd>{formatNumber(client.sessionCount)}</dd></div>
            </dl>
            <h4>Últimas atividades</h4>
            <ul className="admin-history-list">
              {(client.recentActivity || []).map((item) => (
                <li key={item.id}>
                  <strong>{formatDateTime(item.createdAt)}</strong>
                  <span>{eventLabel(item.eventType)} {item.contractId ? `• contrato ${item.contractId}` : ""}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function ActivityDetailModal({ activity, onClose }) {
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-dialog admin-dialog-wide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>{eventLabel(activity.eventType)}</h3>
        <dl className="admin-detail-grid">
          <div><dt>Cliente ID</dt><dd>{activity.sgpCustomerId || activity.customerId}</dd></div>
          <div><dt>Contrato</dt><dd>{activity.contractId || "—"}</dd></div>
          <div><dt>Página</dt><dd>{activity.page || "—"}</dd></div>
          <div><dt>Data/hora</dt><dd>{formatDateTime(activity.createdAt)}</dd></div>
          <div><dt>IP</dt><dd>{activity.ipHash || "—"}</dd></div>
          <div><dt>Dispositivo</dt><dd>{activity.deviceType || "—"}</dd></div>
        </dl>
        <label className="admin-field">
          <span>User Agent</span>
          <textarea readOnly value={activity.userAgent || ""} rows={3} />
        </label>
        <label className="admin-field">
          <span>Informações adicionais</span>
          <textarea readOnly value={JSON.stringify(activity.metadata || {}, null, 2)} rows={6} />
        </label>
        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function BugReportDetailModal({ state, onClose, onUpdated }) {
  const report = state.report;
  const [status, setStatus] = useState(report.status || "novo");
  const [adminNotes, setAdminNotes] = useState(report.adminNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(report.status || "novo");
    setAdminNotes(report.adminNotes || "");
  }, [report]);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await updateBugReport(report.id, { status, adminNotes });
      onUpdated(result);
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível salvar o relatório.");
    } finally {
      setSaving(false);
    }
  }

  const technicalContext = JSON.stringify(report.context || {}, null, 2);

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-dialog admin-dialog-wide admin-bug-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>Relatório #{report.id}</h3>
        {state.error ? <p className="admin-muted">{state.error}</p> : null}
        {state.loading ? <p className="admin-muted">Carregando…</p> : null}
        <dl className="admin-detail-grid">
          <div><dt>Cliente</dt><dd>{report.customerName || report.sgpCustomerId || report.customerId}</dd></div>
          <div><dt>CPF</dt><dd>{report.cpfMasked || "—"}</dd></div>
          <div><dt>Cliente ID</dt><dd>{report.sgpCustomerId || report.customerId}</dd></div>
          <div><dt>Contrato</dt><dd>{report.contractId || "—"}</dd></div>
          <div><dt>Categoria</dt><dd>{report.category}</dd></div>
          <div><dt>Status</dt><dd><BugStatusPill status={report.status} /></dd></div>
          <div><dt>Página</dt><dd>{report.page || "—"}</dd></div>
          <div><dt>Data/hora</dt><dd>{formatDateTime(report.createdAt)}</dd></div>
        </dl>

        <label className="admin-field">
          <span>Descrição</span>
          <textarea readOnly value={report.description || ""} rows={6} />
        </label>

        <form className="admin-bug-admin-form" onSubmit={handleSave}>
          {error ? <div className="admin-inline-notice tone-danger"><AlertTriangle size={16} /><span>{error}</span></div> : null}
          <label className="admin-field">
            <span>Status administrativo</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {BUG_REPORT_STATUSES.filter((item) => item.value).map((item) => (
                <option value={item.value} key={item.value}>{bugStatusLabel(item.value)}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Notas internas</span>
            <textarea
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="Anotações visíveis somente para administradores."
            />
          </label>
          <div className="admin-dialog-actions">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>

        <h4>Informações técnicas</h4>
        <dl className="admin-detail-grid">
          <div><dt>Rota</dt><dd>{report.context?.rotaAtual || report.page || "—"}</dd></div>
          <div><dt>URL</dt><dd>{report.url || report.context?.urlAtual || "—"}</dd></div>
          <div><dt>Navegador</dt><dd>{report.context?.ambiente || "—"}</dd></div>
          <div><dt>Resolução</dt><dd>{report.context?.resolucaoTela || "—"}</dd></div>
          <div><dt>Versão frontend</dt><dd>{report.frontendVersion || report.context?.versaoFrontend || "—"}</dd></div>
          <div><dt>Atualizado em</dt><dd>{formatDateTime(report.updatedAt)}</dd></div>
        </dl>
        <label className="admin-field">
          <span>User Agent</span>
          <textarea readOnly value={report.userAgent || ""} rows={3} />
        </label>
        <label className="admin-field">
          <span>Contexto</span>
          <textarea readOnly value={technicalContext} rows={8} />
        </label>

        <h4>Histórico</h4>
        {state.history?.length ? (
          <ul className="admin-history-list">
            {state.history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.adminEmail || "admin"}</strong>
                <span>
                  {bugStatusLabel(entry.beforeStatus)} → {bugStatusLabel(entry.afterStatus)} • {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-muted">Nenhum histórico ainda.</p>
        )}

        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await adminLogin(email, password);
      onAuthenticated(result);
    } catch (caughtError) {
      setError(
        caughtError instanceof AdminApiError
          ? caughtError.message
          : "Não foi possível entrar agora. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="admin-login-brand">
          <Bell size={24} />
          <h1>Avisos da Central</h1>
        </div>
        <p className="admin-login-subtitle">Acesso restrito a administradores AcessaNet.</p>

        {error ? (
          <div className="admin-inline-notice tone-danger">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <label className="admin-field">
          <span>Usuário</span>
          <input type="text" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
        </label>

        <label className="admin-field">
          <span>Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function NoticesListPage({ admin, onNavigate }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [historyNotice, setHistoryNotice] = useState(null);
  const [previewNotice, setPreviewNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listNotices();
      setNotices(Array.isArray(result) ? result : []);
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar os avisos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleActive(notice) {
    setPendingAction(notice.id);
    try {
      await setNoticeActive(notice.id, notice.version, !notice.active);
      await load();
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível atualizar o status.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDuplicate(notice) {
    setPendingAction(notice.id);
    try {
      const copy = await duplicateNotice(notice.id);
      await load();
      onNavigate(`/admin/avisos/${copy.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível duplicar o aviso.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete(notice) {
    setPendingAction(notice.id);
    try {
      await deleteNotice(notice.id, notice.version);
      setConfirmTarget(null);
      await load();
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível excluir o aviso.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Avisos da Central</h2>
        {can(admin, "avisos.create") ? (
          <button type="button" className="admin-btn admin-btn-primary" onClick={() => onNavigate("/admin/avisos/novo")}>
            <Plus size={16} />
            Novo aviso
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="admin-inline-notice tone-danger">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <p className="admin-muted">Carregando…</p>
      ) : notices.length === 0 ? (
        <p className="admin-muted">Nenhum aviso cadastrado ainda.</p>
      ) : (
        <div className="admin-notice-grid">
          {notices.map((notice) => (
            <article className="admin-notice-card" key={notice.id}>
              <div className="admin-notice-card-head">
                <span className={`admin-status-dot ${notice.active ? "is-active" : "is-inactive"}`} />
                <h3>{notice.title}</h3>
              </div>

              <dl className="admin-notice-meta">
                <div>
                  <dt>Tipo</dt>
                  <dd>{TYPE_LABELS[notice.type] || notice.type}</dd>
                </div>
                <div>
                  <dt>Exibição</dt>
                  <dd>{DISPLAY_LABELS[notice.display] || notice.display}</dd>
                </div>
                <div>
                  <dt>Público</dt>
                  <dd>{AUDIENCE_TYPE_LABELS[notice.audienceType] || notice.audienceType}</dd>
                </div>
                <div>
                  <dt>Período</dt>
                  <dd>
                    {formatDateTime(notice.startsAt)} até {notice.endsAt ? formatDateTime(notice.endsAt) : "sem data final"}
                  </dd>
                </div>
                <div>
                  <dt>Visualizações</dt>
                  <dd>
                    {notice.stats?.totalViews ?? 0} ({notice.stats?.uniqueCustomers ?? 0} clientes)
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{notice.active ? "Ativo" : "Inativo"}</dd>
                </div>
              </dl>

              <div className="admin-notice-actions">
                <button type="button" className="admin-btn admin-btn-soft" onClick={() => setPreviewNotice(notice)}>
                  <Eye size={15} />
                  Pré-visualizar
                </button>
                <button type="button" className="admin-btn admin-btn-soft" onClick={() => setHistoryNotice(notice)}>
                  <History size={15} />
                  Histórico
                </button>
                {can(admin, "avisos.update") ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-soft"
                    onClick={() => onNavigate(`/admin/avisos/${notice.id}`)}
                  >
                    <Pencil size={15} />
                    Editar
                  </button>
                ) : null}
                {can(admin, "avisos.create") ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-soft"
                    disabled={pendingAction === notice.id}
                    onClick={() => handleDuplicate(notice)}
                  >
                    <Copy size={15} />
                    Duplicar
                  </button>
                ) : null}
                {can(admin, "avisos.publish") ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-soft"
                    disabled={pendingAction === notice.id}
                    onClick={() => handleToggleActive(notice)}
                  >
                    <Power size={15} />
                    {notice.active ? "Desativar" : "Ativar"}
                  </button>
                ) : null}
                {can(admin, "avisos.delete") ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => setConfirmTarget(notice)}
                  >
                    <Trash2 size={15} />
                    Excluir
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {previewNotice ? <PreviewDialog notice={previewNotice} onClose={() => setPreviewNotice(null)} /> : null}
      {historyNotice ? <HistoryDialog notice={historyNotice} onClose={() => setHistoryNotice(null)} /> : null}

      {confirmTarget ? (
        <ConfirmDialog
          title="Excluir aviso permanentemente?"
          message={`"${confirmTarget.title}" deixará de existir para os clientes. Esta ação usa exclusão reversível apenas no banco (soft delete), mas some da listagem imediatamente.`}
          confirmLabel="Excluir"
          danger
          pending={pendingAction === confirmTarget.id}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => handleDelete(confirmTarget)}
        />
      ) : null}
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, danger, pending, onCancel, onConfirm }) {
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="admin-dialog" role="alertdialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-soft" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className={danger ? "admin-btn admin-btn-danger" : "admin-btn admin-btn-primary"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Aguarde…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryDialog({ notice, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getNoticeHistory(notice.id)
      .then((result) => {
        if (active) setEntries(Array.isArray(result) ? result : []);
      })
      .catch(() => {
        if (active) setEntries([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [notice.id]);

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-dialog admin-dialog-wide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>Histórico — {notice.title}</h3>
        {loading ? (
          <p className="admin-muted">Carregando…</p>
        ) : entries.length === 0 ? (
          <p className="admin-muted">Nenhum histórico ainda.</p>
        ) : (
          <ul className="admin-history-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.action}</strong>
                <span>
                  {entry.adminEmail || "admin"} — {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewDialog({ notice, onClose }) {
  const [viewport, setViewport] = useState("desktop");
  const previewNotice = useMemo(() => ({ ...notice, id: "preview", version: 1 }), [notice]);

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-dialog admin-dialog-wide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="admin-preview-head">
          <h3>Pré-visualização</h3>
          <div className="admin-preview-toggle">
            <button
              type="button"
              className={viewport === "desktop" ? "is-active" : ""}
              onClick={() => setViewport("desktop")}
            >
              <Monitor size={15} />
              Desktop
            </button>
            <button
              type="button"
              className={viewport === "mobile" ? "is-active" : ""}
              onClick={() => setViewport("mobile")}
            >
              <Smartphone size={15} />
              Mobile
            </button>
          </div>
        </div>

        <div className={`admin-preview-frame is-${viewport}`}>
          {notice.display === "banner" ? (
            <div className="central-notice-banner-stack">
              <NoticeBanner notice={previewNotice} onDismiss={() => {}} />
            </div>
          ) : notice.display === "card" ? (
            <NoticeCard notice={previewNotice} />
          ) : (
            <div className="admin-preview-modal-wrapper">
              <NoticeModal notice={previewNotice} onDismiss={() => {}} />
            </div>
          )}
        </div>

        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

const defaultFormState = {
  title: "",
  message: "",
  imageUrl: "",
  type: "informativo",
  display: "banner",
  priority: "normal",
  dismissible: true,
  frequency: "always",
  origin: "manual",
  audienceType: "all",
  audienceValues: "",
  startsAt: "",
  endsAt: "",
  active: true
};

function noticeToFormState(notice) {
  const audienceFilter = notice.audienceFilter;
  const audienceValues = audienceFilter
    ? (audienceFilter.contractIds || audienceFilter.customerIds || audienceFilter.planNames || audienceFilter.cities || audienceFilter.states || audienceFilter.statuses || []).join(", ")
    : "";

  return {
    title: notice.title,
    message: notice.message,
    imageUrl: notice.imageUrl || "",
    type: notice.type,
    display: notice.display,
    priority: notice.priority,
    dismissible: notice.dismissible,
    frequency: notice.frequency,
    origin: notice.origin,
    audienceType: notice.audienceType || "all",
    audienceValues,
    startsAt: notice.startsAt ? toLocalDateTimeInput(notice.startsAt) : "",
    endsAt: notice.endsAt ? toLocalDateTimeInput(notice.endsAt) : "",
    active: notice.active
  };
}

function toLocalDateTimeInput(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formStateToPayload(form) {
  const values = form.audienceValues
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  let audienceFilter = null;
  if (form.audienceType !== "all" && values.length > 0) {
    const key =
      form.audienceType === "contract"
        ? "contractIds"
        : form.audienceType === "customer"
          ? "customerIds"
          : form.audienceType === "plan"
            ? "planNames"
            : form.audienceType === "city"
              ? "cities"
              : form.audienceType === "state"
                ? "states"
                : "statuses";
    audienceFilter = { type: form.audienceType, [key]: values };
  }

  return {
    title: form.title.trim(),
    message: form.message.trim(),
    imageUrl: form.imageUrl.trim() || null,
    type: form.type,
    display: form.display,
    priority: form.priority,
    dismissible: form.dismissible,
    frequency: form.frequency,
    origin: form.origin,
    audienceFilter,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    active: form.active
  };
}

function NoticeFormPage({ admin, mode, noticeId, onNavigate }) {
  const [form, setForm] = useState(defaultFormState);
  const [expectedVersion, setExpectedVersion] = useState(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [previewViewport, setPreviewViewport] = useState("desktop");

  useEffect(() => {
    if (mode !== "edit" || !noticeId) {
      return;
    }
    let active = true;
    getNotice(noticeId)
      .then((notice) => {
        if (!active) return;
        setForm(noticeToFormState(notice));
        setExpectedVersion(notice.version);
      })
      .catch((caughtError) => {
        if (!active) return;
        setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar o aviso.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, noticeId]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function update(patch) {
    setDirty(true);
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleCancel() {
    if (dirty && !window.confirm("Você tem alterações não salvas. Sair sem salvar?")) {
      return;
    }
    onNavigate("/admin/avisos");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = formStateToPayload(form);
      if (mode === "create") {
        const created = await createNotice(payload);
        setDirty(false);
        onNavigate(`/admin/avisos/${created.id}`);
      } else {
        const updated = await updateNotice(noticeId, { ...payload, expectedVersion });
        setDirty(false);
        setExpectedVersion(updated.version);
        setForm(noticeToFormState(updated));
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof AdminApiError
          ? caughtError.message
          : "Não foi possível salvar o aviso. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  const canPublish = can(admin, "avisos.publish");
  const modalAlwaysConflict = form.display === "modal" && form.frequency === "always";
  const previewNotice = useMemo(
    () => ({
      id: "preview",
      version: 1,
      title: form.title || "Título do aviso",
      message: form.message || "Mensagem do aviso.",
      imageUrl: form.imageUrl.trim() || null,
      type: form.type,
      display: form.display,
      priority: form.priority,
      dismissible: form.dismissible,
      frequency: form.frequency
    }),
    [form]
  );

  if (loading) {
    return <p className="admin-muted">Carregando…</p>;
  }

  return (
    <form className="admin-form-layout" onSubmit={handleSubmit}>
      <div className="admin-page-head">
        <button type="button" className="admin-btn admin-btn-ghost" onClick={handleCancel}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <h2>{mode === "create" ? "Novo aviso" : "Editar aviso"}</h2>
      </div>

      {error ? (
        <div className="admin-inline-notice tone-danger">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="admin-form-grid">
        <div className="admin-form-main">
          <fieldset className="admin-fieldset">
            <legend>
              <Megaphone size={16} />
              Conteúdo
            </legend>
            <label className="admin-field">
              <span>Título</span>
              <input
                type="text"
                required
                maxLength={150}
                value={form.title}
                onChange={(event) => update({ title: event.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>Mensagem</span>
              <textarea
                required
                rows={4}
                maxLength={3000}
                value={form.message}
                onChange={(event) => update({ message: event.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>Imagem (URL, opcional)</span>
              <input
                type="url"
                placeholder="https://..."
                maxLength={2048}
                value={form.imageUrl}
                onChange={(event) => update({ imageUrl: event.target.value })}
              />
              <p className="admin-field-hint">
                Link direto de uma imagem já hospedada (http/https). Aparece no lugar do ícone, no topo do aviso.
              </p>
            </label>
            <label className="admin-field">
              <span>Tipo de aviso</span>
              <select value={form.type} onChange={(event) => update({ type: event.target.value })}>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Exibição</legend>
            <label className="admin-field">
              <span>Forma de exibição</span>
              <select value={form.display} onChange={(event) => update({ display: event.target.value })}>
                {Object.entries(DISPLAY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>Prioridade</span>
              <select value={form.priority} onChange={(event) => update({ priority: event.target.value })}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Comportamento</legend>
            <label className="admin-checkbox-field">
              <input
                type="checkbox"
                checked={form.dismissible}
                onChange={(event) => update({ dismissible: event.target.checked })}
              />
              <span>Permitir que o cliente feche o aviso</span>
            </label>
            <label className="admin-field">
              <span>Mostrar</span>
              <select value={form.frequency} onChange={(event) => update({ frequency: event.target.value })}>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {modalAlwaysConflict ? (
              <p className="admin-field-hint tone-danger">
                Modal não pode usar "Sempre" — o cliente ficaria vendo o popup em toda navegação. Escolha "uma vez por
                sessão" ou "uma vez por cliente".
              </p>
            ) : null}
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Agendamento</legend>
            <label className="admin-field">
              <span>Início (deixe em branco para exibir imediatamente)</span>
              <input type="datetime-local" value={form.startsAt} onChange={(event) => update({ startsAt: event.target.value })} />
            </label>
            <label className="admin-field">
              <span>Fim (opcional — em branco fica até desativar manualmente)</span>
              <input type="datetime-local" value={form.endsAt} onChange={(event) => update({ endsAt: event.target.value })} />
            </label>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Público-alvo</legend>
            <label className="admin-field">
              <span>Público</span>
              <select value={form.audienceType} onChange={(event) => update({ audienceType: event.target.value })}>
                {Object.entries(AUDIENCE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {form.audienceType !== "all" ? (
              <label className="admin-field">
                <span>
                  Valores (separados por vírgula) —{" "}
                  {form.audienceType === "contract"
                    ? "IDs de contrato"
                    : form.audienceType === "customer"
                      ? "IDs de cliente"
                      : form.audienceType === "plan"
                        ? "nomes de plano"
                        : form.audienceType === "city"
                          ? "cidades"
                          : form.audienceType === "state"
                            ? "estados (UF)"
                            : "status (ex: ACTIVE, SUSPENDED)"}
                </span>
                <textarea
                  rows={2}
                  value={form.audienceValues}
                  onChange={(event) => update({ audienceValues: event.target.value })}
                />
              </label>
            ) : null}
            <p className="admin-field-hint">
              Bairro, POP, OLT, região e grupo de clientes ainda não têm dado disponível no sistema — quando existir,
              serão adicionados aqui sem precisar mudar o banco.
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Publicação</legend>
            <label className="admin-checkbox-field">
              <input
                type="checkbox"
                checked={form.active}
                disabled={!canPublish}
                onChange={(event) => update({ active: event.target.checked })}
              />
              <span>Publicar imediatamente (deixe desmarcado para salvar como rascunho)</span>
            </label>
            {!canPublish ? <p className="admin-field-hint">Sua permissão não inclui publicar avisos.</p> : null}
          </fieldset>

          <div className="admin-form-actions">
            <button type="button" className="admin-btn admin-btn-soft" onClick={handleCancel}>
              Cancelar
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || modalAlwaysConflict}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>

        <aside className="admin-form-preview">
          <div className="admin-preview-head">
            <h3>Pré-visualização</h3>
            <div className="admin-preview-toggle">
              <button
                type="button"
                className={previewViewport === "desktop" ? "is-active" : ""}
                onClick={() => setPreviewViewport("desktop")}
              >
                <Monitor size={15} />
              </button>
              <button
                type="button"
                className={previewViewport === "mobile" ? "is-active" : ""}
                onClick={() => setPreviewViewport("mobile")}
              >
                <Smartphone size={15} />
              </button>
            </div>
          </div>
          <div className={`admin-preview-frame is-${previewViewport}`}>
            {form.display === "banner" ? (
              <div className="central-notice-banner-stack">
                <NoticeBanner notice={previewNotice} onDismiss={() => {}} />
              </div>
            ) : form.display === "card" ? (
              <NoticeCard notice={previewNotice} />
            ) : (
              <div className="admin-preview-modal-wrapper">
                <NoticeModal notice={previewNotice} onDismiss={() => {}} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
