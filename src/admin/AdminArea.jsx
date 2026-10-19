import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
	  BarChart3,
	  Bell,
	  Briefcase,
	  Bug,
	  ClipboardSignature,
	  Copy,
  Download,
  Eye,
  Headset,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Router,
  Search,
  ShieldCheck,
  Smartphone,
  Monitor,
  Trash2,
  Trophy,
  Users
} from "lucide-react";
import {
  AdminApiError,
  adminLogin,
  adminLogout,
  changeAdminPassword,
  clearAdminTokens,
  adminMe,
  createNotice,
  deleteNotice,
  downloadJobApplicationFile,
  duplicateNotice,
  exportChamadosCsv,
  getChamadoDetail,
  getChamadosSummary,
  getContractRequest,
  getContractRequestsSummary,
  getNotice,
  getNoticeHistory,
  getAnalyticsClient,
	  getAnalyticsOverview,
	  getBugReport,
	  getBugReportsSummary,
	  getCentralAnalytics,
	  getJobApplicationsSummary,
  listAnalyticsActivity,
	  listAnalyticsClients,
	  listAnalyticsEvents,
	  listBugReports,
	  listChamados,
	  listContractRequestAssignees,
	  listContractRequests,
	  listJobApplications,
	  listMarketingLeads,
	  listContractMarketingLeads,
	getSellerRanking,
	listSellers,
	createSeller,
	updateSeller,
	  listNotices,
	  readAdminTokens,
	  searchOltClients,
	  setNoticeActive,
	  updateBugReport,
	  updateContractRequest,
	  updateJobApplication,
	  updateNotice
} from "./adminApi";
import PageMeta from "../cliente/PageMeta";
// Mesmos componentes e estilos de avisos da Central (prévia fiel do que o cliente vê).
import NoticeBanner from "../cliente/central/NoticeBanner";
import NoticeCard from "../cliente/central/NoticeCard";
import NoticeModal from "../cliente/central/NoticeModal";
import "../cliente/styles/clienteArea.css";
import "../cliente/styles/centralNotices.css";
import "./styles/adminArea.css";
import "./styles/adminArea.lab.css";
import adminLogo from "./admin-logo-acessanet.png";

/** Fontes do site novo (Sora nos títulos, Manrope no texto), só no painel. */

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
  { key: "contratacoes", path: "/admin/contratacoes", label: "Contratações", icon: ClipboardSignature },
  { key: "vendedores", path: "/admin/vendedores", label: "Vendedores", icon: Trophy },
  { key: "notices", path: "/admin/avisos", label: "Avisos", icon: Bell },
  { key: "marketing", path: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { key: "bugs", path: "/admin/bugs", label: "Bugs relatados", icon: Bug },
  { key: "curriculos", path: "/admin/curriculos", label: "Currículos", icon: Briefcase },
  { key: "chamados", path: "/admin/chamados", label: "Chamados", icon: Headset },
  { key: "central", path: "/admin/central", label: "Central", icon: BarChart3 },
  { key: "clients", path: "/admin/clientes", label: "Clientes", icon: Users },
  { key: "oltcloud", path: "/admin/rede", label: "Rede (OLT)", icon: Router },
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

const JOB_APPLICATION_STATUSES = [
  { value: "", label: "Todos" },
  { value: "novo", label: "Novos" },
  { value: "em_analise", label: "Em análise" },
  { value: "contatado", label: "Contatados" },
  { value: "arquivado", label: "Arquivados" }
];

const JOB_APPLICATION_STATUS_LABELS = {
  novo: "Novo",
  em_analise: "Em análise",
  contatado: "Contatado",
  arquivado: "Arquivado"
};

const PLAN_LEAD_PERIOD_LABELS = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  qualquer: "Qualquer horário"
};

const JOB_APPLICATION_AREAS = ["Suporte Técnico", "Instalador", "Atendimento", "Administrativo", "Outra"];

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
  admin: ["avisos.read", "avisos.create", "avisos.update", "avisos.delete", "avisos.publish", "contratacoes.read", "contratacoes.update", "usuarios.manage", "ranking.read"],
  editor: ["avisos.read", "avisos.create", "avisos.update", "avisos.publish", "contratacoes.read", "contratacoes.update", "ranking.read"],
  viewer: ["avisos.read"],
  vendedor: ["contratacoes.read", "contratacoes.update"]
};

const ROLE_LABELS = { admin: "Administrador", editor: "Editor", viewer: "Visualizador", vendedor: "Vendedor(a)" };

/** Vendedor(a) só vê Contratações (o backend também barra o resto); os demais veem o menu conforme a permissão. */
function sectionsFor(admin) {
  if (admin?.role === "vendedor") return ADMIN_SECTIONS.filter((section) => section.key === "contratacoes");
  return ADMIN_SECTIONS.filter((section) => {
    if (section.key === "contratacoes") return can(admin, "contratacoes.read");
    if (section.key === "vendedores") return can(admin, "ranking.read");
    return true;
  });
}

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
	    marketing: "Marketing",
	    new: "Novo aviso",
	    edit: "Editar aviso",
	    bugs: "Bugs relatados",
	    curriculos: "Currículos",
	    contratacoes: "Contratações",
	    vendedores: "Vendedores",
	    chamados: "Chamados",
	    central: "Central do Assinante",
    clients: "Clientes",
    oltcloud: "Rede (OLT)",
    activity: "Histórico de Atividades"
  };
  return labels[pageKey] || "Admin AcessaNet";
}

function getPageKey(pathname) {
  if (pathname === "/admin/login") return "login";
  if (pathname === "/admin" || pathname === "/admin/") return "overview";
	  if (pathname === "/admin/central") return "central";
	  if (pathname === "/admin/clientes") return "clients";
	  if (pathname === "/admin/rede") return "oltcloud";
	  if (pathname === "/admin/historico") return "activity";
	  if (pathname === "/admin/bugs") return "bugs";
	  if (pathname === "/admin/curriculos") return "curriculos";
	  // /admin/leads era o pedido de plano antigo; os pedidos agora estão em Contratações.
	  if (pathname === "/admin/contratacoes" || pathname === "/admin/leads") return "contratacoes";
	  if (pathname === "/admin/vendedores") return "vendedores";
	  if (pathname === "/admin/chamados") return "chamados";
	  if (pathname === "/admin/avisos") return "notices";
	  if (pathname === "/admin/marketing") return "marketing";
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
	  const [jobNewCount, setJobNewCount] = useState(0);
	  const [contractNewCount, setContractNewCount] = useState(0);
	  const [changingPassword, setChangingPassword] = useState(false);

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

	  const refreshJobSummary = useCallback(async () => {
	    try {
	      const summary = await getJobApplicationsSummary();
	      setJobNewCount(Number(summary.newCount || 0));
	    } catch {
	      setJobNewCount(0);
	    }
	  }, []);

	  /** viewer nao tem contratacoes.read (dados pessoais): nem mostra o menu nem chama o resumo. */
	  const canSeeContracts = can(admin, "contratacoes.read");

	  const refreshContractSummary = useCallback(async () => {
	    try {
	      const summary = await getContractRequestsSummary();
	      setContractNewCount(Number(summary.newCount || 0));
	    } catch {
	      setContractNewCount(0);
	    }
	  }, []);

	  const isSeller = admin?.role === "vendedor";

	  useEffect(() => {
	    if (admin) {
	      // Vendedor(a) não tem acesso a bugs/currículos: nem chama (o backend responderia 403).
	      if (!isSeller) {
	        void refreshBugSummary();
	        void refreshJobSummary();
	      }
	      if (canSeeContracts) void refreshContractSummary();
	    }
	  }, [admin, canSeeContracts, isSeller, refreshBugSummary, refreshJobSummary, refreshContractSummary]);

  async function handleLogout() {
    await adminLogout().catch(() => {});
    setAdmin(null);
    navigate("/admin/login", { replace: true });
  }

  if (bootstrapping) {
    return <div className="admin-loading-screen admin-lab">Carregando painel administrativo…</div>;
  }

  if (!admin) {
    return <AdminLogin onAuthenticated={setAdmin} />;
  }

  const pageInfo = getPageKey(location.pathname);
  const rawPageKey = typeof pageInfo === "string" ? pageInfo : pageInfo.key;
  /** viewer em /admin/contratacoes cai na Visão Geral -- topbar e corpo precisam concordar. */
  const allowedKeys = new Set(sectionsFor(admin).map((section) => section.key));
  const isSectionKey = ADMIN_SECTIONS.some((section) => section.key === rawPageKey);
  const pageKey = isSectionKey && !allowedKeys.has(rawPageKey) ? (isSeller ? "contratacoes" : "overview") : isSeller && !isSectionKey ? "contratacoes" : rawPageKey;
  const editingId = typeof pageInfo === "object" ? pageInfo.id : null;

  return (
    <div className="admin-shell admin-lab">
      <PageMeta title={`${pageTitle(pageKey)} | Admin AcessaNet`} />

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <img src={adminLogo} alt="AcessaNet" />
            <span>Painel administrativo</span>
          </div>
          <nav className="admin-nav" aria-label="Navegação administrativa">
            {sectionsFor(admin).map((section) => {
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
	                  {section.key === "curriculos" && jobNewCount > 0 ? <em className="admin-nav-badge">{jobNewCount}</em> : null}
	                  {section.key === "contratacoes" && contractNewCount > 0 ? <em className="admin-nav-badge">{contractNewCount}</em> : null}
	                </button>
              );
            })}
          </nav>
          <div className="admin-sidebar-user">
            <span className="admin-avatar" aria-hidden="true">{(admin.name || "A").trim().charAt(0).toUpperCase()}</span>
            <span className="admin-sidebar-user-text">
              <strong>{admin.name}</strong>
              <small>{ROLE_LABELS[admin.role] || admin.role}</small>
            </span>
          </div>
        </aside>

        <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-brand">
            <img src={adminLogo} alt="" className="admin-topbar-logo" />
            <span className="admin-topbar-crumb">
              <ShieldCheck size={15} aria-hidden="true" />
              Admin AcessaNet
            </span>
            <strong className="admin-topbar-title">{pageTitle(pageKey)}</strong>
          </div>
          <div className="admin-topbar-user">
            <span className="admin-topbar-name">
              {admin.name} <small>({ROLE_LABELS[admin.role] || admin.role})</small>
            </span>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setChangingPassword(true)}>
              <KeyRound size={16} />
              Trocar senha
            </button>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={handleLogout}>
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </header>

        <main className="admin-content">
          {pageKey === "overview" ? (
            <OverviewPage />
          ) : pageKey === "notices" ? (
            <NoticesListPage admin={admin} onNavigate={navigate} />
          ) : pageKey === "marketing" ? (
            <MarketingPage />
          ) : pageKey === "new" ? (
            <NoticeFormPage admin={admin} mode="create" onNavigate={navigate} />
          ) : pageKey === "edit" ? (
            <NoticeFormPage admin={admin} mode="edit" noticeId={editingId} onNavigate={navigate} />
	          ) : pageKey === "central" ? (
	            <CentralStatsPage />
	          ) : pageKey === "bugs" ? (
	            <BugReportsPage onChanged={refreshBugSummary} />
	          ) : pageKey === "contratacoes" ? (
	            <ContractRequestsPage onChanged={refreshContractSummary} />
	          ) : pageKey === "vendedores" ? (
	            <SellersPage admin={admin} />
	          ) : pageKey === "curriculos" ? (
	            <JobApplicationsPage onChanged={refreshJobSummary} />
	          ) : pageKey === "chamados" ? (
	            <ChamadosPage />
	          ) : pageKey === "clients" ? (
            <ClientsPage />
          ) : pageKey === "oltcloud" ? (
            <OltClientsPage />
          ) : pageKey === "activity" ? (
            <ActivityHistoryPage />
          ) : (
            <OverviewPage />
          )}
        </main>
        </div>
      </div>
      {changingPassword ? (
        <ChangePasswordDialog
          onClose={() => setChangingPassword(false)}
          onDone={() => {
            // O backend já derrubou todas as sessões; só falta limpar o navegador.
            clearAdminTokens();
            setChangingPassword(false);
            setAdmin(null);
            navigate("/admin/login", { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}

/** Troca da própria senha (todos os cargos, inclusive vendedor). Ao concluir, a pessoa entra de novo. */
function ChangePasswordDialog({ onClose, onDone }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("A confirmação não é igual à nova senha.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await changeAdminPassword({ currentPassword, newPassword });
      setDone(true);
    } catch (caughtError) {
      const fields = caughtError instanceof AdminApiError ? caughtError.details?.fieldErrors : null;
      const first = fields ? Object.values(fields).flat()[0] : null;
      setError(first || (caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível trocar a senha."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={done ? undefined : onClose}>
      <div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="change-password-title" onClick={(event) => event.stopPropagation()}>
        <h3 id="change-password-title">Trocar minha senha</h3>
        {done ? (
          <>
            <p>Senha trocada. Por segurança, entre de novo com a senha nova.</p>
            <div className="admin-dialog-actions">
              <button type="button" className="admin-btn admin-btn-primary" onClick={onDone}>Entrar novamente</button>
            </div>
          </>
        ) : (
          <form className="admin-form-layout" onSubmit={handleSubmit}>
            {error ? <div className="admin-inline-notice tone-danger"><AlertTriangle size={16} /><span>{error}</span></div> : null}
            <label className="admin-field">
              <span>Senha atual</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" autoFocus />
            </label>
            <label className="admin-field">
              <span>Nova senha (mínimo 12 caracteres)</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
            </label>
            <label className="admin-field">
              <span>Repita a nova senha</span>
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
            </label>
            <div className="admin-dialog-actions">
              <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>Cancelar</button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>{saving ? "Trocando…" : "Trocar senha"}</button>
            </div>
          </form>
        )}
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

  // Todos os cards seguem o período escolhido (antes, 5 eram fixos em hoje/7/30 dias/total
  // e não mudavam ao trocar o filtro).
  const cards = [
    ["Acessos", data?.totals?.accesses],
    ["Clientes únicos", data?.totals?.uniqueClients],
    ["Sessões", data?.totals?.sessions],
    ["Novos usuários", data?.totals?.newClients],
    ["Clientes retornaram", data?.totals?.returningClients],
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

const SELLER_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Senha forte sem caracteres que se confundem (0/O, 1/l/I): feita para ser enviada à pessoa. */
function generateSellerPassword(length = 14) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => SELLER_PASSWORD_ALPHABET[value % SELLER_PASSWORD_ALPHABET.length]).join("");
}

function sellerErrorText(caughtError, fallback) {
  if (!(caughtError instanceof AdminApiError)) return fallback;
  const fields = caughtError.details?.fieldErrors;
  const first = fields ? Object.values(fields).flat()[0] : null;
  return first || caughtError.message || fallback;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function SellersPage({ admin }) {
  const canManage = can(admin, "usuarios.manage");
  const [period, setPeriod] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ranking, setRanking] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState("");
  const [sellers, setSellers] = useState([]);
  const [sellersLoading, setSellersLoading] = useState(canManage);
  const [sellersError, setSellersError] = useState("");
  const [form, setForm] = useState(() => ({ name: "", email: "", password: generateSellerPassword() }));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");

  const params = useMemo(() => ({ period, ...(period === "custom" ? { from, to } : {}) }), [from, period, to]);

  const loadRanking = useCallback(async () => {
    setRankingLoading(true);
    setRankingError("");
    try {
      setRanking(await getSellerRanking(params));
    } catch (caughtError) {
      setRankingError(sellerErrorText(caughtError, "Não foi possível carregar o ranking."));
    } finally {
      setRankingLoading(false);
    }
  }, [params]);

  const loadSellers = useCallback(async () => {
    if (!canManage) return;
    setSellersLoading(true);
    setSellersError("");
    try {
      const result = await listSellers();
      setSellers(result.items || []);
    } catch (caughtError) {
      setSellersError(sellerErrorText(caughtError, "Não foi possível carregar os vendedores."));
    } finally {
      setSellersLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadRanking();
  }, [loadRanking]);

  useEffect(() => {
    void loadSellers();
  }, [loadSellers]);

  async function showCredentials(next) {
    setCredentials(next);
    setCopied(await copyText(`E-mail: ${next.email}\nSenha: ${next.password}`));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const created = await createSeller({ name: form.name, email: form.email, password: form.password });
      await showCredentials({ name: created.name, email: created.email, password: form.password, kind: "created" });
      setForm({ name: "", email: "", password: generateSellerPassword() });
      void loadSellers();
      void loadRanking();
    } catch (caughtError) {
      setFormError(sellerErrorText(caughtError, "Não foi possível criar o acesso."));
    } finally {
      setSaving(false);
    }
  }

  function openReset(seller) {
    setResetTarget(seller);
    setResetPassword(generateSellerPassword());
    setResetError("");
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    if (!resetTarget) return;
    setResetSaving(true);
    setResetError("");
    try {
      // Trocar a senha também desconecta a pessoa (no backend), então ela entra de novo com a senha nova.
      await updateSeller(resetTarget.id, { password: resetPassword });
      await showCredentials({ name: resetTarget.name, email: resetTarget.email, password: resetPassword, kind: "reset" });
      setResetTarget(null);
    } catch (caughtError) {
      setResetError(sellerErrorText(caughtError, "Não foi possível trocar a senha."));
    } finally {
      setResetSaving(false);
    }
  }

  async function handleToggleActive(seller) {
    const next = !seller.active;
    if (!next && !window.confirm(`Desativar ${seller.name}? Ela é desconectada agora e não consegue entrar. Os atendimentos continuam no histórico.`)) return;
    setBusyId(seller.id);
    setSellersError("");
    try {
      await updateSeller(seller.id, { active: next });
      await loadSellers();
      void loadRanking();
    } catch (caughtError) {
      setSellersError(sellerErrorText(caughtError, "Não foi possível alterar o acesso."));
    } finally {
      setBusyId("");
    }
  }

  const items = ranking?.items || [];

  return (
    <div className="admin-page-stack">
      <PageHeader title="Vendedores" period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />

      <section className="admin-panel">
        <h3>Ranking de atendimentos</h3>
        <p className="admin-muted">
          Pedidos de contratação do período por responsável. <strong>Atendidos</strong> são os pedidos assumidos que já saíram de
          “Novo”; <strong>Contratados</strong> viraram assinatura.
        </p>
        <InlineState loading={rankingLoading} error={rankingError} />
        {!rankingLoading && !rankingError ? (
          items.length === 0 ? (
            <p className="admin-muted">Nenhum vendedor cadastrado ainda.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Vendedor(a)</th>
                    <th>Pedidos assumidos</th>
                    <th>Atendidos</th>
                    <th>Contratados</th>
                    <th>Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, index) => (
                    <tr key={row.adminId}>
                      <td>{index === 0 && row.attended > 0 ? <Trophy size={16} aria-label="1º lugar" /> : index + 1}</td>
                      <td>
                        {row.name}
                        {!row.active ? <small className="admin-muted"> (inativo)</small> : null}
                      </td>
                      <td>{formatNumber(row.assigned)}</td>
                      <td><strong>{formatNumber(row.attended)}</strong></td>
                      <td>{formatNumber(row.won)}</td>
                      <td>{row.attended > 0 ? `${Math.round((row.won / row.attended) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
        {ranking && ranking.unassigned > 0 ? (
          <p className="admin-muted">
            {formatNumber(ranking.unassigned)} {ranking.unassigned === 1 ? "pedido do período ainda está" : "pedidos do período ainda estão"} sem responsável.
          </p>
        ) : null}
      </section>

      {canManage ? (
        <>
          <section className="admin-panel">
            <h3>Novo(a) vendedor(a)</h3>
            <p className="admin-muted">
              Cria um acesso que só enxerga as Contratações. Envie o e-mail e a senha para a pessoa; ela não aparece de novo.
            </p>
            {credentials ? (
              <div className="admin-inline-notice tone-warning" role="status">
                <ShieldCheck size={16} />
                <span>
                  {credentials.kind === "created" ? "Acesso criado" : "Senha trocada"} para <strong>{credentials.name}</strong>.{" "}
                  E-mail: <strong>{credentials.email}</strong> · Senha: <strong>{credentials.password}</strong>{" "}
                  {copied ? "(copiado)" : ""}
                  <button
                    type="button"
                    className="admin-btn admin-btn-soft"
                    onClick={async () => setCopied(await copyText(`E-mail: ${credentials.email}\nSenha: ${credentials.password}`))}
                  >
                    <Copy size={14} /> Copiar
                  </button>
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setCredentials(null)}>
                    Já anotei
                  </button>
                </span>
              </div>
            ) : null}
            <form className="admin-form-layout" onSubmit={handleCreate}>
              {formError ? <div className="admin-inline-notice tone-danger"><AlertTriangle size={16} /><span>{formError}</span></div> : null}
              <label className="admin-field">
                <span>Nome</span>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} maxLength={120} autoComplete="off" />
              </label>
              <label className="admin-field">
                <span>E-mail (será o login)</span>
                <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={254} autoComplete="off" />
              </label>
              <label className="admin-field">
                <span>Senha (mínimo 12 caracteres)</span>
                <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={12} maxLength={128} autoComplete="off" spellCheck={false} />
                <p className="admin-field-hint">
                  Já vem uma senha forte gerada.{" "}
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setForm({ ...form, password: generateSellerPassword() })}>
                    <RefreshCw size={14} /> Gerar outra
                  </button>
                </p>
              </label>
              <div className="admin-form-actions">
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  <Plus size={16} /> {saving ? "Criando…" : "Criar acesso"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-panel">
            <h3>Equipe de vendas</h3>
            <InlineState loading={sellersLoading} error={sellersError} />
            {!sellersLoading && !sellersError && sellers.length === 0 ? <p className="admin-muted">Nenhum vendedor cadastrado.</p> : null}
            {sellers.length > 0 ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Situação</th>
                      <th>Criado em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((seller) => (
                      <tr key={seller.id}>
                        <td>{seller.name}</td>
                        <td>{seller.email}</td>
                        <td><span className={`admin-status-pill ${seller.active ? "tone-corrigido" : "tone-ignorado"}`}>{seller.active ? "Ativo" : "Inativo"}</span></td>
                        <td>{formatDateTime(seller.createdAt)}</td>
                        <td>
                          <button type="button" className="admin-btn admin-btn-soft" disabled={busyId === seller.id} onClick={() => openReset(seller)}>
                            Trocar senha
                          </button>{" "}
                          <button type="button" className="admin-btn admin-btn-soft" disabled={busyId === seller.id} onClick={() => handleToggleActive(seller)}>
                            <Power size={14} /> {seller.active ? "Desativar" : "Reativar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {resetTarget ? (
        <div className="admin-dialog-backdrop" role="presentation" onClick={() => setResetTarget(null)}>
          <div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="seller-reset-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="seller-reset-title">Trocar a senha de {resetTarget.name}</h3>
            <p className="admin-muted">
              Login: <strong>{resetTarget.email}</strong>. Ao confirmar, a senha antiga deixa de valer e a pessoa é desconectada.
              Envie a nova senha para ela.
            </p>
            <form className="admin-form-layout" onSubmit={handleResetSubmit}>
              {resetError ? <div className="admin-inline-notice tone-danger"><AlertTriangle size={16} /><span>{resetError}</span></div> : null}
              <label className="admin-field">
                <span>Nova senha (mínimo 12 caracteres)</span>
                <input
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
                <p className="admin-field-hint">
                  Já vem uma senha forte gerada; você pode digitar outra.{" "}
                  <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setResetPassword(generateSellerPassword())}>
                    <RefreshCw size={14} /> Gerar outra
                  </button>
                </p>
              </label>
              <div className="admin-dialog-actions">
                <button type="button" className="admin-btn admin-btn-soft" onClick={() => setResetTarget(null)}>Cancelar</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={resetSaving}>
                  {resetSaving ? "Trocando…" : "Trocar senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function marketingSourceError(caughtError, fallback) {
  if (!(caughtError instanceof AdminApiError)) return fallback;
  if (caughtError.status === 403) return "Sem permissão para ver os dados de contratação.";
  return caughtError.message || fallback;
}

function MarketingPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  // Duas fontes independentes: se uma falhar (Connect fora do ar, sem
  // permissão de contratações), a outra continua aparecendo.
  const loadLeads = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const [wifi, contract] = await Promise.allSettled([listMarketingLeads(), listContractMarketingLeads()]);
    const merged = [];
    const failed = [];
    if (wifi.status === "fulfilled") {
      for (const lead of Array.isArray(wifi.value) ? wifi.value : []) {
        merged.push({
          key: `wifi-${lead.visitorId}`,
          name: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          source: "Wi-Fi público",
          detail: lead.establishment || "—",
          consentAt: lead.marketingConsentAt,
        });
      }
    } else {
      failed.push(`Wi-Fi público: ${marketingSourceError(wifi.reason, "não foi possível carregar.")}`);
    }
    if (contract.status === "fulfilled") {
      for (const lead of contract.value?.items || []) {
        merged.push({
          key: `contrato-${lead.id}`,
          name: lead.customerName,
          email: lead.email,
          phone: lead.whatsapp,
          source: "Contratação online",
          detail: `${lead.planName} · ${lead.city} · ${lead.protocol}`,
          consentAt: lead.consentAt,
        });
      }
    } else {
      failed.push(`Contratação online: ${marketingSourceError(contract.reason, "não foi possível carregar.")}`);
    }
    merged.sort((a, b) => new Date(b.consentAt) - new Date(a.consentAt));
    setLeads(merged);
    setErrors(failed);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Marketing</h2>
        <p className="admin-muted">
          Pessoas que autorizaram receber ofertas e novidades: visitantes do Wi-Fi
          público (AcessaNet Connect) e quem marcou a opção na contratação online.
        </p>
      </div>
      <InlineState loading={loading} error="" />
      {!loading
        ? errors.map((message) => <InlineState key={message} loading={false} error={message} />)
        : null}
      {!loading && leads.length === 0 && errors.length < 2 ? (
        <p className="admin-muted">Ninguém com opt-in de marketing ainda.</p>
      ) : null}
      {!loading && leads.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Celular</th>
                <th>Origem</th>
                <th>Detalhe</th>
                <th>Consentimento em</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.key}>
                  <td>{lead.name}</td>
                  <td>{lead.email || "—"}</td>
                  <td>{lead.phone}</td>
                  <td><span className="admin-status-pill">{lead.source}</span></td>
                  <td>{lead.detail}</td>
                  <td>{formatDateTime(lead.consentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
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

const CONTRACT_REQUEST_STATUSES = [
  { value: "", label: "Todos" },
  { value: "novo", label: "Novos" },
  { value: "em_analise", label: "Em análise" },
  { value: "sem_cobertura", label: "Sem cobertura" },
  { value: "em_atendimento", label: "Em atendimento" },
  { value: "agendado", label: "Agendados" },
  { value: "contratado", label: "Contratados" },
  { value: "cancelado", label: "Cancelados" }
];

const CONTRACT_REQUEST_STATUS_LABELS = {
  novo: "Novo",
  em_analise: "Em análise",
  sem_cobertura: "Sem cobertura",
  em_atendimento: "Em atendimento",
  agendado: "Agendado",
  contratado: "Contratado",
  cancelado: "Cancelado"
};

/** Reaproveita as cores dos Leads (tone-lead-*) em vez de criar CSS novo. */
const CONTRACT_REQUEST_STATUS_TONES = {
  novo: "novo",
  em_analise: "em_contato",
  em_atendimento: "em_contato",
  agendado: "em_contato",
  contratado: "contratado",
  sem_cobertura: "sem_viabilidade",
  cancelado: "perdido"
};

/** Mesmos ids/nomes do catálogo do servidor (server/src/contracting/planCatalog.ts). */
const CONTRACT_PLAN_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "800", label: "Plano 800 Mega" },
  { value: "700", label: "Plano 700 Mega" },
  { value: "700-fixo", label: "Plano 700 Mega + Telefone Fixo" }
];

const CONTRACT_PROTOCOL_RE = /^AC\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/;

function contractStatusLabel(value) {
  return CONTRACT_REQUEST_STATUS_LABELS[value] || value || "—";
}

function ContractStatusPill({ status }) {
  const tone = CONTRACT_REQUEST_STATUS_TONES[status] || "novo";
  return <span className={`admin-status-pill tone-lead-${tone}`}>{contractStatusLabel(status)}</span>;
}

/** WhatsApp é gravado só com dígitos (DDD + número). */
function formatWhatsapp(digits) {
  const value = String(digits || "").replace(/\D/g, "");
  if (value.length === 11) return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
  if (value.length === 10) return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
  return value || "—";
}

function contractWhatsappHref(request) {
  const digits = `55${String(request.whatsapp || "").replace(/\D/g, "")}`;
  const firstName = String(request.customerName || "").split(" ")[0];
  const text = `Olá, ${firstName}! Aqui é da AcessaNet, sobre a sua solicitação ${request.protocol} do ${request.planName}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function contractAddress(request) {
  const line = [request.street, request.number].filter(Boolean).join(", ");
  const extra = [request.complement, request.district].filter(Boolean).join(" · ");
  return [line, extra, `${request.city}${request.uf ? `/${request.uf}` : ""}`, request.cep ? `CEP ${request.cep}` : ""]
    .filter(Boolean)
    .join(" — ");
}

function formatCents(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100);
}

function ContractRequestsPage({ onChanged }) {
  const [status, setStatus] = useState("novo");
  const [planId, setPlanId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [protocol, setProtocol] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Busca e protocolo esperam 300ms sem digitação: cada listagem gera uma linha de auditoria. */
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedProtocol, setDebouncedProtocol] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setDebouncedProtocol(protocol.trim().toUpperCase());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [protocol, search]);

  /** Protocolo só vira filtro quando completo (o servidor exige o formato exato). */
  const normalizedProtocol = debouncedProtocol;
  const protocolParam = CONTRACT_PROTOCOL_RE.test(normalizedProtocol) ? normalizedProtocol : "";
  const protocolIncomplete = Boolean(normalizedProtocol) && !protocolParam;

  const params = useMemo(
    () => ({ page, limit: 30, status, planId, from, to, protocol: protocolParam, search: debouncedSearch }),
    [debouncedSearch, from, page, planId, protocolParam, status, to]
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await listContractRequests(params));
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar as contratações.");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function clearFilters() {
    setStatus("");
    setPlanId("");
    setFrom("");
    setTo("");
    setProtocol("");
    setSearch("");
    setPage(1);
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Contratações</h2>
        <p className="admin-muted">Solicitações de contratação online feitas pelo site, com protocolo. A viabilidade técnica é confirmada pelo comercial.</p>
      </div>
      <FilterBar>
        <label className="admin-field admin-field-inline">
          <span>Status</span>
          <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
            {CONTRACT_REQUEST_STATUSES.map((item) => <option value={item.value} key={item.value || "all"}>{item.label}</option>)}
          </select>
        </label>
        <label className="admin-field admin-field-inline">
          <span>Plano</span>
          <select value={planId} onChange={(event) => { setPage(1); setPlanId(event.target.value); }}>
            {CONTRACT_PLAN_OPTIONS.map((item) => <option value={item.value} key={item.value || "all"}>{item.label}</option>)}
          </select>
        </label>
        <label className="admin-field admin-field-inline">
          <span>De</span>
          <input type="date" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Até</span>
          <input type="date" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Protocolo</span>
          <input
            value={protocol}
            onChange={(event) => { setPage(1); setProtocol(event.target.value); }}
            placeholder="AC261017-7KQ3XD"
            maxLength={15}
          />
        </label>
        <label className="admin-field admin-field-inline">
          <span>Busca</span>
          <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Nome, WhatsApp, cidade..." maxLength={120} />
        </label>
        <button type="button" className="admin-btn admin-btn-soft" onClick={clearFilters}>Limpar</button>
      </FilterBar>
      {protocolIncomplete ? <p className="admin-muted">Digite o protocolo completo (ex.: AC261017-7KQ3XD) para filtrar.</p> : null}
      <InlineState loading={loading} error={error} />
      {!loading && !error && data && data.items.length === 0 ? <p className="admin-muted">Nenhuma solicitação encontrada.</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Protocolo</th>
              <th>Nome</th>
              <th>WhatsApp</th>
              <th>Plano</th>
              <th>Cidade</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Recebido em</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((request) => (
              <tr key={request.id} onClick={() => setSelectedId(request.id)}>
                <td style={{ whiteSpace: "nowrap" }}>{request.protocol}</td>
                <td>{request.customerName}</td>
                <td>{formatWhatsapp(request.whatsapp)}</td>
                <td>{request.planName}</td>
                <td>
                  {request.city}
                  {!request.cityCovered ? <span className="admin-lead-flag">fora da área</span> : null}
                </td>
                <td>{request.assignedAdminName || "—"}</td>
                <td><ContractStatusPill status={request.status} /></td>
                <td>{formatDateTime(request.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager data={data} page={page} setPage={setPage} />
      {selectedId ? (
        <ContractRequestDetailModal
          requestId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={(next) => {
            setData((current) => current ? { ...current, items: current.items.map((item) => item.id === next.id ? { ...item, ...next } : item) } : current);
            void onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

function contractEventText(event, assigneeName) {
  const by = event.adminName ? ` • por ${event.adminName}` : "";
  if (event.type === "created") return "Solicitação recebida pelo site";
  if (event.type === "status_changed") return `Status: ${contractStatusLabel(event.fromValue)} → ${contractStatusLabel(event.toValue)}${by}`;
  if (event.type === "assigned") return `Responsável: ${assigneeName(event.fromValue)} → ${assigneeName(event.toValue)}${by}`;
  if (event.type === "note") return `Nota: ${event.note || ""}${by}`;
  return `${event.type}${by}`;
}

function ContractRequestDetailModal({ requestId, onClose, onUpdated }) {
  const [state, setState] = useState({ loading: true, error: "", request: null, events: [] });
  const [assignees, setAssignees] = useState([]);
  const [status, setStatus] = useState("novo");
  const [assignedAdminId, setAssignedAdminId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const applyDetail = useCallback((detail) => {
    setState({ loading: false, error: "", request: detail.request, events: detail.events || [] });
    setStatus(detail.request.status || "novo");
    setAssignedAdminId(detail.request.assignedAdminId || "");
  }, []);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "", request: null, events: [] });
    Promise.all([getContractRequest(requestId), listContractRequestAssignees().catch(() => ({ items: [] }))])
      .then(([detail, people]) => {
        if (!active) return;
        applyDetail(detail);
        setAssignees(people.items || []);
      })
      .catch((caughtError) => {
        if (!active) return;
        setState({
          loading: false,
          error: caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar a solicitação.",
          request: null,
          events: []
        });
      });
    return () => {
      active = false;
    };
  }, [applyDetail, requestId]);

  const assigneeName = useCallback(
    (id) => {
      if (!id) return "—";
      return assignees.find((item) => item.id === id)?.name || id;
    },
    [assignees]
  );

  const request = state.request;

  async function handleSave(event) {
    event.preventDefault();
    if (!request) return;
    const input = {};
    if (status !== request.status) input.status = status;
    if ((assignedAdminId || null) !== (request.assignedAdminId || null)) input.assignedAdminId = assignedAdminId || null;
    if (note.trim()) input.note = note.trim();
    if (Object.keys(input).length === 0) {
      setError("Nenhuma alteração para salvar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const detail = await updateContractRequest(request.id, input);
      applyDetail(detail);
      setNote("");
      onUpdated(detail.request);
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-dialog admin-dialog-wide admin-bug-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        {state.loading || state.error || !request ? (
          <>
            <h3>Solicitação</h3>
            <InlineState loading={state.loading} error={state.error} />
            <div className="admin-dialog-actions">
              <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>Fechar</button>
            </div>
          </>
        ) : (
          <>
            <h3>{request.protocol} — {request.customerName}</h3>
            {!request.cityCovered ? (
              <div className="admin-inline-notice tone-warning">
                <AlertTriangle size={16} />
                <span>A cidade informada não está na lista de cidades atendidas. Confirme a viabilidade antes de vender.</span>
              </div>
            ) : null}
            <dl className="admin-detail-grid">
              <div><dt>Plano</dt><dd>{request.planName} · {request.planPriceText}</dd></div>
              <div><dt>Preço no pedido</dt><dd>{formatCents(request.planPriceCents)}/mês (catálogo do site)</dd></div>
              <div><dt>WhatsApp</dt><dd><a href={contractWhatsappHref(request)} target="_blank" rel="noreferrer">{formatWhatsapp(request.whatsapp)}</a></dd></div>
              <div><dt>E-mail</dt><dd>{request.email ? <a href={`mailto:${request.email}`}>{request.email}</a> : "—"}</dd></div>
              <div className="admin-detail-wide"><dt>Endereço</dt><dd>{contractAddress(request)}</dd></div>
              <div className="admin-detail-wide"><dt>Observações do interessado</dt><dd>{request.notes || "—"}</dd></div>
              <div><dt>Melhor horário</dt><dd>{PLAN_LEAD_PERIOD_LABELS[request.contactPeriod] || "—"}</dd></div>
              <div><dt>Cidade atendida</dt><dd>{request.cityCovered ? "Sim" : "Não"} <small className="admin-muted">(viabilidade técnica pendente)</small></dd></div>
              <div><dt>Aceita ofertas (marketing)</dt><dd>{request.marketingOptIn ? "Sim" : "Não"}</dd></div>
              <div><dt>Aviso de privacidade</dt><dd>Versão {request.privacyNoticeVersion} · ciente em {formatDateTime(request.privacyNoticeAckAt)}</dd></div>
              <div><dt>Recebido em</dt><dd>{formatDateTime(request.createdAt)}</dd></div>
              <div><dt>Atualizado em</dt><dd>{formatDateTime(request.updatedAt)}</dd></div>
              <div><dt>Status</dt><dd><ContractStatusPill status={request.status} /></dd></div>
              <div><dt>Responsável</dt><dd>{request.assignedAdminName || "—"}</dd></div>
            </dl>

            <div className="admin-dialog-actions admin-lead-actions">
              <a className="admin-btn admin-btn-whats" href={contractWhatsappHref(request)} target="_blank" rel="noreferrer">
                Chamar no WhatsApp
              </a>
              <a className="admin-btn admin-btn-soft" href={`tel:+55${String(request.whatsapp || "").replace(/\D/g, "")}`}>
                Ligar
              </a>
            </div>

            <form className="admin-bug-admin-form" onSubmit={handleSave}>
              {error ? <div className="admin-inline-notice tone-danger"><AlertTriangle size={16} /><span>{error}</span></div> : null}
              <label className="admin-field">
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {CONTRACT_REQUEST_STATUSES.filter((item) => item.value).map((item) => (
                    <option value={item.value} key={item.value}>{contractStatusLabel(item.value)}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Responsável</span>
                <select value={assignedAdminId} onChange={(event) => setAssignedAdminId(event.target.value)}>
                  <option value="">Sem responsável</option>
                  {assignees.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  {request.assignedAdminId && !assignees.some((item) => item.id === request.assignedAdminId) ? (
                    <option value={request.assignedAdminId}>{request.assignedAdminName || request.assignedAdminId}</option>
                  ) : null}
                </select>
              </label>
              <label className="admin-field">
                <span>Nova nota interna</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Ex.: viabilidade confirmada, instalação agendada para sexta."
                />
              </label>
              <div className="admin-dialog-actions">
                <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>Fechar</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </form>

            <h4><History size={16} aria-hidden="true" /> Histórico</h4>
            {state.events.length ? (
              <ul className="admin-history-list">
                {state.events.map((item) => (
                  <li key={item.id}>
                    <strong>{formatDateTime(item.createdAt)}</strong>
                    <span>{contractEventText(item, assigneeName)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-muted">Sem eventos.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function jobStatusLabel(value) {
  return JOB_APPLICATION_STATUS_LABELS[value] || value || "—";
}

function JobStatusPill({ status }) {
  return <span className={`admin-status-pill tone-${status || "novo"}`}>{jobStatusLabel(status)}</span>;
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

async function saveJobApplicationFile(application) {
  const blob = await downloadJobApplicationFile(application.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = application.fileName || `curriculo-${application.id}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function JobApplicationsPage({ onChanged }) {
  const [status, setStatus] = useState("novo");
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => ({ page, limit: 30, status, area, search }), [area, page, search, status]);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await listJobApplications(params));
      await onChanged?.();
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível carregar os currículos.");
    } finally {
      setLoading(false);
    }
  }, [onChanged, params]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  function resetFilters() {
    setStatus("");
    setArea("");
    setSearch("");
    setPage(1);
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Currículos</h2>
        <p className="admin-muted">Enviados pela página "Trabalhe conosco" do site.</p>
      </div>
      <FilterBar>
        <label className="admin-field admin-field-inline">
          <span>Status</span>
          <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
            {JOB_APPLICATION_STATUSES.map((item) => <option value={item.value} key={item.value || "all"}>{item.label}</option>)}
          </select>
        </label>
        <label className="admin-field admin-field-inline">
          <span>Área</span>
          <select value={area} onChange={(event) => { setPage(1); setArea(event.target.value); }}>
            <option value="">Todas</option>
            {JOB_APPLICATION_AREAS.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>
        <label className="admin-field admin-field-inline">
          <span>Busca</span>
          <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Nome, e-mail, telefone..." />
        </label>
        <button type="button" className="admin-btn admin-btn-soft" onClick={resetFilters}>Limpar</button>
      </FilterBar>
      <InlineState loading={loading} error={error} />
      {!loading && !error && data && data.items.length === 0 ? <p className="admin-muted">Nenhum currículo encontrado.</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Telefone</th>
              <th>Área</th>
              <th>Arquivo</th>
              <th>Status</th>
              <th>Recebido em</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((application) => (
              <tr key={application.id} onClick={() => setSelected(application)}>
                <td>#{application.id}</td>
                <td>{application.name}</td>
                <td>{application.email}</td>
                <td>{application.phone}</td>
                <td>{application.area || "—"}</td>
                <td>{application.fileName}</td>
                <td><JobStatusPill status={application.status} /></td>
                <td>{formatDateTime(application.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager data={data} page={page} setPage={setPage} />
      {selected ? (
        <JobApplicationDetailModal
          application={selected}
          onClose={() => setSelected(null)}
          onUpdated={(next) => {
            setSelected(next);
            setData((current) => current ? { ...current, items: current.items.map((item) => item.id === next.id ? next : item) } : current);
            void onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

function JobApplicationDetailModal({ application, onClose, onUpdated }) {
  const [status, setStatus] = useState(application.status || "novo");
  const [adminNotes, setAdminNotes] = useState(application.adminNotes || "");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(application.status || "novo");
    setAdminNotes(application.adminNotes || "");
  }, [application]);

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      await saveJobApplicationFile(application);
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível baixar o currículo.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      onUpdated(await updateJobApplication(application.id, { status, adminNotes }));
    } catch (caughtError) {
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-dialog admin-dialog-wide admin-bug-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>Currículo #{application.id} — {application.name}</h3>
        <dl className="admin-detail-grid">
          <div><dt>E-mail</dt><dd><a href={`mailto:${application.email}`}>{application.email}</a></dd></div>
          <div><dt>Telefone</dt><dd><a href={`tel:${String(application.phone).replace(/[^\d+]/g, "")}`}>{application.phone}</a></dd></div>
          <div><dt>Área de interesse</dt><dd>{application.area || "—"}</dd></div>
          <div><dt>Status</dt><dd><JobStatusPill status={application.status} /></dd></div>
          <div><dt>Recebido em</dt><dd>{formatDateTime(application.createdAt)}</dd></div>
          <div><dt>Arquivo</dt><dd>{application.fileName} ({formatFileSize(application.fileSize)})</dd></div>
        </dl>

        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-primary" onClick={handleDownload} disabled={downloading}>
            <Download size={16} /> {downloading ? "Baixando…" : "Baixar currículo"}
          </button>
        </div>

        <label className="admin-field">
          <span>Sobre o candidato</span>
          <textarea readOnly value={application.message || "—"} rows={5} />
        </label>

        <form className="admin-bug-admin-form" onSubmit={handleSave}>
          {error ? <div className="admin-inline-notice tone-danger"><AlertTriangle size={16} /><span>{error}</span></div> : null}
          <label className="admin-field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {JOB_APPLICATION_STATUSES.filter((item) => item.value).map((item) => (
                <option value={item.value} key={item.value}>{jobStatusLabel(item.value)}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Notas internas</span>
            <textarea
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Anotações visíveis somente para administradores."
            />
          </label>
          <div className="admin-dialog-actions">
            <button type="button" className="admin-btn admin-btn-soft" onClick={onClose}>Fechar</button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
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

const CONNECTION_STATUS_LABELS = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  UNKNOWN: "Sem dados"
};

function ConnectionStatusPill({ status }) {
  const tone = (status || "UNKNOWN").toLowerCase();
  return <span className={`admin-status-pill tone-conexao-${tone}`}>{CONNECTION_STATUS_LABELS[status] || "Sem dados"}</span>;
}

/**
 * Busca clientes direto na OLT Cloud (nome, documento, pppoe ou contrato) --
 * consulta ao vivo num sistema de terceiros, nunca uma tabela local, por
 * isso dispara so no submit (nao a cada tecla, como ClientsPage faz com a
 * analytics local). Documento sempre mascarado pelo backend antes de chegar
 * aqui (ver adminOltCloudRoutes.ts); nunca existe pppoe_password na resposta.
 */
function OltClientsPage() {
  const [documentValue, setDocumentValue] = useState("");
  const [name, setName] = useState("");
  const [pppoe, setPppoe] = useState("");
  const [contractId, setContractId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();

    if (!documentValue.trim() && !name.trim() && !pppoe.trim() && !contractId.trim()) {
      setError("Informe ao menos um filtro: documento, nome, PPPoE ou contrato.");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const result = await searchOltClients({
        document: documentValue.trim() || undefined,
        name: name.trim() || undefined,
        pppoe: pppoe.trim() || undefined,
        contractId: contractId.trim() || undefined
      });
      setData(result);
    } catch (caughtError) {
      setData(null);
      setError(caughtError instanceof AdminApiError ? caughtError.message : "Não foi possível buscar na OLT Cloud agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page-stack">
      <div className="admin-page-head">
        <h2>Rede (OLT)</h2>
      </div>
      <p className="admin-muted">Busca ao vivo direto na OLT Cloud -- não é a base de clientes da Central.</p>

      <form onSubmit={handleSearch}>
        <FilterBar>
          <label className="admin-field admin-field-inline">
            <span>Documento</span>
            <input value={documentValue} onChange={(event) => setDocumentValue(event.target.value)} placeholder="CPF ou CNPJ" />
          </label>
          <label className="admin-field admin-field-inline">
            <span>Nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do cliente" />
          </label>
          <label className="admin-field admin-field-inline">
            <span>PPPoE</span>
            <input value={pppoe} onChange={(event) => setPppoe(event.target.value)} placeholder="usuario@provedor" />
          </label>
          <label className="admin-field admin-field-inline">
            <span>Contrato</span>
            <input value={contractId} onChange={(event) => setContractId(event.target.value)} />
          </label>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
            {loading ? <RefreshCw size={16} className="cliente-spin" /> : <Search size={16} />}
            Buscar
          </button>
        </FilterBar>
      </form>

      <InlineState loading={loading} error={error} />

      {!loading && !error && searched ? (
        <>
          {data?.truncated ? (
            <p className="admin-inline-notice tone-warning">
              Mostrando {data.clients.length} de {formatNumber(data.total)} resultados -- refine a busca para ver todos.
            </p>
          ) : null}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>PPPoE</th>
                  <th>Conexão</th>
                  <th>Status</th>
                  <th>Plano</th>
                  <th>Contrato</th>
                  <th>Cidade/UF</th>
                  <th>Contato</th>
                </tr>
              </thead>
              <tbody>
                {(data?.clients || []).map((client) => (
                  <tr key={`${client.id}-${client.externalContractId}`} title={client.addressLine || ""}>
                    <td>{client.name || "—"}</td>
                    <td>{client.maskedDocument || "—"}</td>
                    <td>{client.pppoe || "—"}</td>
                    <td><ConnectionStatusPill status={client.connectionStatus} /></td>
                    <td>{client.status || "—"}</td>
                    <td>{client.plan || "—"}</td>
                    <td>{client.externalContractId || "—"}</td>
                    <td>{client.city ? `${client.city}/${client.state}` : "—"}</td>
                    <td>{client.contact || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && data.clients.length === 0 ? <p className="admin-muted">Nenhum cliente encontrado.</p> : null}
          </div>
        </>
      ) : null}
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
    <div className="admin-login-page admin-lab">
      <PageMeta title="Entrar | Admin AcessaNet" />
      <span className="admin-login-glow" aria-hidden="true" />
      <img src={adminLogo} alt="AcessaNet" className="admin-login-logo" />
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="admin-login-brand">
          <span className="admin-eyebrow">Painel administrativo</span>
          <h1>Entrar no admin</h1>
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
