import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
	  ArrowUpRight,
	  BadgeCheck,
	  Bell,
	  Bug,
	  CalendarClock,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Copy,
  CreditCard,
  Ellipsis,
  Eye,
  EyeOff,
  FileSignature,
  Gauge,
  Globe2,
  HandCoins,
  Home,
  KeyRound,
  LifeBuoy,
  Lightbulb,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  PhoneCall,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  Ribbon,
  Router,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  Wifi,
  WifiOff,
  Wrench,
  Zap,
  X
} from "lucide-react";
import logo from "../assets/logo acessa (2).png";
import logoLight from "../assets/logobase.png";
import { seasonalCampaign } from "../theme/siteTheme";
import {
  ClienteApiError,
  changePassword,
  chatRequest,
	  checkLocalAccess,
	  clearTokens,
	  clienteRequest,
	  createBugReport,
	  createClientMessageId,
  forgotPassword,
  getChatToken,
  getMaskedEmailForReset,
  getPaymentPromiseStatus,
  listActiveNotices,
  listContractSignatures,
  logSignatureEvent,
  loginLocal,
  logoutCustomer,
  maskCpf,
  normalizeCpf,
  readSelectedContractId,
  readTokens,
  recordCentralActivity,
  recordNoticeView,
  resetPasswordWithToken,
  saveSelectedContractId,
  setupLocalPassword,
  verifyResetCode
} from "../services/clienteApi";
import NoticeBanner from "../components/central/NoticeBanner";
import NetworkIncidentBanner from "../components/central/NetworkIncidentBanner";
import NoticeCard from "../components/central/NoticeCard";
import NoticeModal from "../components/central/NoticeModal";
import { hasSeenThisSession, markSeenThisSession } from "../components/central/noticeSessionState";
import SignaturePendingModal from "../components/central/SignaturePendingModal";
import SignaturePendingBanner from "../components/central/SignaturePendingBanner";
import {
  clearSignatureModalSessionState,
  hasShownSignatureModalThisSession,
  markSignatureModalShownThisSession
} from "../components/central/signaturePendingSessionState";
import PlanUpgradeShowcase from "../components/central/PlanUpgradeShowcase";
import PlanUpgradeModal from "../components/central/PlanUpgradeModal";
import PaymentPromiseModal from "../components/central/PaymentPromiseModal";
import {
  PLAN_UPGRADE_BENEFITS,
  RECOMMENDED_PLAN,
  calculatePriceDifference,
  isEligibleForUpgrade,
  resolveCurrentPlanPrice,
  resolveRecommendedPlanPrice
} from "../data/planUpgradeCatalog";
import { PLAN_UPGRADE_EVENTS, trackPlanUpgradeEvent } from "../utils/planUpgradeAnalytics";
import { formatCurrency } from "../utils/format";
import "../styles/clienteArea.css";
import "../styles/components-styles/clienteHome.css";
import "../styles/components-styles/clienteAreaSkin.css";
import "../styles/components-styles/clienteLogin.css";
import "../styles/components-styles/centralNotices.css";
import "../styles/components-styles/planUpgrade.css";
import "../styles/components-styles/signatures.css";
import "../styles/components-styles/paymentPromise.css";

/**
 * Desativado a pedido do cliente (2026-10-02) enquanto o endpoint real do
 * SGPSign nao e confirmado -- esconde o menu/pagina/modal/banner e para de
 * consultar o backend. Religar (true) quando a integracao real (ou um
 * mock controlado) estiver pronta pra mostrar a clientes de verdade.
 */
const SIGNATURES_FEATURE_ENABLED = false;

const navItems = [
  { to: "/cliente", label: "Início", icon: Home, exact: true },
  { to: "/cliente/internet", label: "Internet", icon: Wifi },
  { to: "/cliente/faturas", label: "Faturas", icon: CircleDollarSign },
  { to: "/cliente/plano", label: "Plano", icon: BadgeCheck },
  { to: "/cliente/atendimento", label: "Atendimento", icon: MessageCircle },
  { to: "/cliente/chamados", label: "Chamados", icon: Ticket },
  { to: "/cliente/assinaturas", label: "Assinaturas", icon: FileSignature },
  { to: "/cliente/perfil", label: "Perfil", icon: UserRound }
];

const mobileNavItems = [
  navItems[0],
  navItems[2],
  navItems[4],
  navItems[5],
  navItems[7]
];

const bugReportCategories = [
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

const attendanceCategoryOrder = [
  "router_password",
  "wifi_problem",
  "intermittent",
  "slow_internet",
  "no_internet",
  "websites",
  "equipment",
  "phone",
  "other"
];

const financialAttendanceCategories = [
  {
    id: "billing_second_copy",
    title: "2ª via de boleto",
    description: "Solicitar emissão da segunda via do boleto."
  },
  {
    id: "billing_dispute",
    title: "Contestação de cobrança",
    description: "Informar cobrança indevida ou dúvida sobre valores."
  }
];

const financialAttendanceCategoryIds = new Set(financialAttendanceCategories.map((category) => category.id));

const offlineDiagnosticOptions = [
  { id: "red_light", label: "Luz vermelha no modem/ONU" },
  { id: "no_red_light", label: "Nenhuma luz vermelha" },
  { id: "equipment_off", label: "Modem/ONU está apagado" },
  { id: "lights_normal", label: "As luzes estão normais, mas continuo sem internet" },
  { id: "unknown", label: "Não sei identificar" }
];

const attendanceIssueVisuals = {
  no_internet: {
    icon: WifiOff,
    tone: "red",
    tip: "Antes de abrir o atendimento, confirme se o roteador está ligado e se os cabos estão conectados."
  },
  slow_internet: {
    icon: Gauge,
    tone: "orange",
    tip: "Se possível, faça um teste próximo ao roteador antes de abrir o atendimento."
  },
  intermittent: {
    icon: Zap,
    tone: "green",
    tip: "Observe se as quedas acontecem em todos os aparelhos ou apenas em um dispositivo."
  },
  wifi_problem: {
    icon: Wifi,
    tone: "blue",
    tip: "Tente aproximar o dispositivo do roteador para verificar se o sinal melhora."
  },
  router_password: {
    icon: KeyRound,
    tone: "purple",
    tip: "Tenha em mãos o nome da rede Wi-Fi que deseja alterar para agilizar o atendimento."
  },
  websites: {
    icon: Globe2,
    tone: "amber",
    tip: "Verifique se o problema acontece em mais de um navegador ou apenas em um site específico."
  },
  equipment: {
    icon: Router,
    tone: "teal",
    tip: "Confira se as luzes do modem estão acesas e se os cabos estão bem encaixados."
  },
  phone: {
    icon: PhoneCall,
    tone: "sky",
    tip: "Confira se o aparelho telefônico está ligado corretamente antes de abrir o atendimento."
  },
  other: {
    icon: Ellipsis,
    tone: "slate",
    tip: "Descreva o problema com o máximo de detalhes para direcionarmos melhor seu atendimento."
  },
  billing_second_copy: {
    icon: ClipboardList,
    tone: "amber",
    tip: "Tenha em mãos o mês de referência do boleto para agilizar a solicitação."
  },
  billing_dispute: {
    icon: CircleDollarSign,
    tone: "orange",
    tip: "Tenha em mãos o boleto ou valor que deseja verificar com o atendimento."
  }
};

export default function ClienteArea() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [connection, setConnection] = useState(null);
  const [billing, setBilling] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState("");
  const [promiseStatus, setPromiseStatus] = useState(null);
  const [promiseStatusLoading, setPromiseStatusLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [categories, setCategories] = useState([]);
  const [signatureData, setSignatureData] = useState(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [dismissedNoticeKeys, setDismissedNoticeKeys] = useState(() => new Set());
  const recordedNoticeViewsRef = useRef(new Set());
  /**
   * Cancelamento + guarda contra corrida assincrona: troca de contrato ou
   * novo login na mesma aba precisa invalidar qualquer requisicao ainda em
   * andamento da selecao/sessao anterior -- sem isso, uma resposta lenta de
   * connection/billing/invoices de um cliente anterior pode chegar depois e
   * sobrescrever os dados do cliente atual (causa raiz de um vazamento de
   * dados entre clientes confirmado nesta Central -- ver investigacao).
   */
  const customerDataAbortRef = useRef(null);
  const invoicesAbortRef = useRef(null);
  const promiseStatusAbortRef = useRef(null);
  const selectedContractApiIdRef = useRef("");

  useEffect(() => {
    document.body.classList.add("cliente-area-shell");

    return () => {
      document.body.classList.remove("cliente-area-shell");
    };
  }, []);

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === selectedContractId) || contracts[0],
    [contracts, selectedContractId]
  );
  const selectedContractApiId = selectedContract?.id || "";

  useEffect(() => {
    selectedContractApiIdRef.current = selectedContractApiId;
  }, [selectedContractApiId]);

  const authenticated = Boolean(customer);
  const pageKey = getPageKey(location.pathname);

  useEffect(() => {
    if (!authenticated) return;

    const eventByPage = {
      inicio: "VIEW_HOME",
      plano: "VIEW_PLAN",
      faturas: "VIEW_INVOICES",
      internet: "VIEW_CONNECTION",
      chamados: "VIEW_TICKETS"
    };
    const eventType = eventByPage[pageKey];
    if (!eventType) return;

    void recordCentralActivity({
      eventType,
      page: pageKey,
      contractId: selectedContractApiId || undefined
    }).catch(() => {});
  }, [authenticated, pageKey, selectedContractApiId]);

  const setSelectedContract = useCallback(
    (contractId) => {
      setSelectedContractId(contractId);
      saveSelectedContractId(customer?.id, contractId);
    },
    [customer?.id]
  );

  const bootstrap = useCallback(async () => {
    const { accessToken } = readTokens();
    if (!accessToken) {
      setBootstrapping(false);
      return;
    }

    try {
      const [profile, contractList] = await Promise.all([
        clienteRequest("/api/me"),
        clienteRequest("/v1/contracts")
      ]);

      const nextContracts = Array.isArray(contractList) ? contractList : [];
      const storedContractId = readSelectedContractId(profile?.id);
      const nextContractId = pickDefaultContractId(nextContracts, storedContractId);

      setCustomer(profile);
      setContracts(nextContracts);
      setSelectedContractId(nextContractId);
      saveSelectedContractId(profile?.id, nextContractId);
    } catch {
      clearTokens();
      setCustomer(null);
      setContracts([]);
      setSelectedContractId("");
    } finally {
      setBootstrapping(false);
    }
  }, []);

  const refreshCustomerData = useCallback(async () => {
    if (!selectedContractApiId) {
      return;
    }

    // Cancela qualquer busca anterior ainda em andamento (troca de contrato
    // ou novo login na mesma aba) -- sem isso, uma resposta lenta de um
    // contrato/cliente anterior pode chegar depois e sobrescrever os dados
    // do cliente atual.
    customerDataAbortRef.current?.abort();
    const controller = new AbortController();
    customerDataAbortRef.current = controller;
    const { signal } = controller;
    const contractIdAtRequestTime = selectedContractApiId;

    setDataLoading(true);
    setDataError("");

    /**
     * Cada chamada atualiza seu proprio state assim que ELA resolve, em vez
     * de esperar o Promise.all inteiro -- ConnectionHeroCard/InvoiceHighlightCard
     * ja sao desenhados pra aparecer independentemente (ver "initialLoading"
     * em ClienteHome), mas isso so tinha efeito se os dados chegassem em
     * momentos diferentes. Antes, o set* de tudo so rodava depois que a
     * chamada MAIS LENTA das 7 (ex: SGP externo) terminasse, entao a tela
     * inteira ficava esperando o pior caso. Rede/concorrencia e exatamente a
     * mesma (tudo ainda dispara junto); so a hora de cada setState mudou.
     *
     * Alem do cancelamento acima, cada setter so aplica o resultado se o
     * contrato selecionado NO MOMENTO em que a resposta chega (lido de uma
     * ref, nunca da closure) ainda for o mesmo -- segunda camada de defesa,
     * independente do AbortController, contra dados de um cliente/contrato
     * anterior vazarem para a tela do cliente atual. connection/billing
     * sempre trazem contractId na resposta (ver types.ts) -- comparar contra
     * esse campo, nunca contra o id que foi usado pra montar a URL.
     */
    const connectionPromise = settle(clienteRequest(`/v1/contracts/${selectedContractApiId}/connection`, { signal })).then(
      (result) => {
        if (result.ok && result.data?.contractId === selectedContractApiIdRef.current) {
          setConnection(result.data);
        }
        return result;
      }
    );
    const billingPromise = settle(clienteRequest(`/v1/contracts/${selectedContractApiId}/billing`, { signal })).then(
      (result) => {
        if (result.ok && result.data?.contractId === selectedContractApiIdRef.current) {
          setBilling(result.data);
        }
        return result;
      }
    );
    const ticketsPromise = settle(clienteRequest("/v1/support/tickets", { signal })).then((result) => {
      if (result.ok && selectedContractApiIdRef.current === contractIdAtRequestTime) {
        setTickets(Array.isArray(result.data) ? result.data : []);
      }
      return result;
    });
    const currentTicketPromise = settle(clienteRequest(`/v1/contracts/${selectedContractApiId}/ticket`, { signal })).then(
      (result) => {
        if (result.ok && selectedContractApiIdRef.current === contractIdAtRequestTime) {
          setCurrentTicket(result.data);
        }
        return result;
      }
    );
    const categoriesPromise = settle(clienteRequest("/v1/support/categories", { signal })).then((result) => {
      // Catalogo estatico/global (nao depende de cliente/contrato) -- sem risco de vazamento.
      if (result.ok) setCategories(Array.isArray(result.data) ? result.data : []);
      return result;
    });
    const noticesPromise = settle(listActiveNotices(selectedContractApiId, signal)).then((result) => {
      if (result.ok && selectedContractApiIdRef.current === contractIdAtRequestTime) {
        setNotices(Array.isArray(result.data) ? result.data : []);
      }
      return result;
    });
    // "signatures" fica fora da contagem de falhas criticas abaixo (igual a "notices") --
    // uma falha so na integracao de assinaturas nunca deve acionar o banner global
    // "Dados indisponíveis" da Central inteira.
    const signaturesPromise = SIGNATURES_FEATURE_ENABLED
      ? settle(listContractSignatures(selectedContractApiId, signal)).then((result) => {
          if (selectedContractApiIdRef.current === contractIdAtRequestTime) {
            setSignatureData(result.ok ? result.data : null);
          }
          return result;
        })
      : Promise.resolve().then(() => {
          setSignatureData(null);
          return { ok: false };
        });

    const [nextConnection, nextBilling, nextTickets, nextCurrentTicket, nextCategories] = await Promise.all([
      connectionPromise,
      billingPromise,
      ticketsPromise,
      currentTicketPromise,
      categoriesPromise
    ]);
    await Promise.all([noticesPromise, signaturesPromise]);

    // Esta chamada foi substituida por uma mais nova (troca de contrato/
    // logout) -- quem a substituiu ja esta cuidando de dataLoading/dataError.
    if (signal.aborted) {
      return;
    }

    const failures = [nextConnection, nextBilling, nextTickets, nextCurrentTicket, nextCategories].filter(
      (item) => !item.ok
    );

    if (failures.length === 5) {
      setDataError(resolveErrorMessage(failures[0].error, "Não foi possível carregar seus dados."));
    }

    setDataLoading(false);
  }, [selectedContractApiId]);

  const refreshInvoices = useCallback(async () => {
    if (!selectedContractApiId) {
      return;
    }

    invoicesAbortRef.current?.abort();
    const controller = new AbortController();
    invoicesAbortRef.current = controller;

    setInvoicesLoading(true);
    setInvoicesError("");

    try {
      const response = await clienteRequest(`/v1/contracts/${selectedContractApiId}/invoices`, { signal: controller.signal });
      if (response?.contractId === selectedContractApiIdRef.current) {
        setInvoiceData(response);
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      setInvoiceData(null);
      setInvoicesError(resolveErrorMessage(error, "Não foi possível consultar suas faturas."));
    } finally {
      if (!controller.signal.aborted) {
        setInvoicesLoading(false);
      }
    }
  }, [selectedContractApiId]);

  const refreshPromiseStatus = useCallback(async () => {
    if (!selectedContractApiId) {
      return;
    }

    promiseStatusAbortRef.current?.abort();
    const controller = new AbortController();
    promiseStatusAbortRef.current = controller;

    setPromiseStatusLoading(true);

    try {
      const response = await getPaymentPromiseStatus(selectedContractApiId, controller.signal);
      if (selectedContractApiIdRef.current === selectedContractApiId) {
        setPromiseStatus(response || null);
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      setPromiseStatus(null);
    } finally {
      if (!controller.signal.aborted) {
        setPromiseStatusLoading(false);
      }
    }
  }, [selectedContractApiId]);

  const handlePromiseSuccess = useCallback(() => {
    void refreshInvoices();
    void refreshPromiseStatus();
    void refreshCustomerData();
  }, [refreshCustomerData, refreshInvoices, refreshPromiseStatus]);

  const refreshPageData = useCallback(async () => {
    await Promise.all([
      refreshCustomerData(),
      pageKey === "faturas" || pageKey === "inicio" ? refreshInvoices() : Promise.resolve()
    ]);
  }, [pageKey, refreshCustomerData, refreshInvoices]);

  const visibleNotices = useMemo(
    () =>
      notices.filter(
        (notice) =>
          !dismissedNoticeKeys.has(`${notice.id}:${notice.version}`) &&
          !(notice.frequency === "once_per_session" && hasSeenThisSession(notice.id, notice.version))
      ),
    [notices, dismissedNoticeKeys]
  );
  const bannerNotices = useMemo(() => visibleNotices.filter((notice) => notice.display === "banner"), [visibleNotices]);
  const cardNotices = useMemo(() => visibleNotices.filter((notice) => notice.display === "card"), [visibleNotices]);
  const modalQueue = useMemo(() => visibleNotices.filter((notice) => notice.display === "modal"), [visibleNotices]);
  const modalNotice = modalQueue[0] || null;
  const shownNotices = useMemo(
    () => [...bannerNotices, ...cardNotices, ...(modalNotice ? [modalNotice] : [])],
    [bannerNotices, cardNotices, modalNotice]
  );

  const handleDismissNotice = useCallback((notice) => {
    setDismissedNoticeKeys((current) => new Set(current).add(`${notice.id}:${notice.version}`));
    if (notice.frequency === "once_per_session") {
      markSeenThisSession(notice.id, notice.version);
    }
  }, []);

  useEffect(() => {
    for (const notice of shownNotices) {
      if (notice.frequency === "once_per_session") {
        markSeenThisSession(notice.id, notice.version);
      }
    }
  }, [shownNotices]);

  useEffect(() => {
    for (const notice of shownNotices) {
      const key = `${notice.id}:${notice.version}`;
      if (recordedNoticeViewsRef.current.has(key)) {
        continue;
      }
      recordedNoticeViewsRef.current.add(key);
      void recordNoticeView(notice.id, selectedContractApiId).catch(() => {});
    }
  }, [shownNotices, selectedContractApiId]);

  const pendingSignatures = useMemo(
    () => (Array.isArray(signatureData?.signatures) ? signatureData.signatures.filter((item) => item.status === "pending") : []),
    [signatureData]
  );

  useEffect(() => {
    // Guarda explicita: nunca abre durante o carregamento inicial, nem
    // empilha com o modal do sistema de avisos administrativo (so um por
    // vez -- o aviso administrativo tem prioridade).
    if (
      SIGNATURES_FEATURE_ENABLED &&
      !dataLoading &&
      signatureData != null &&
      pendingSignatures.length > 0 &&
      !modalNotice &&
      customer?.id &&
      !hasShownSignatureModalThisSession(customer.id, selectedContractApiId)
    ) {
      markSignatureModalShownThisSession(customer.id, selectedContractApiId);
      setSignatureModalOpen(true);
    }
  }, [dataLoading, signatureData, pendingSignatures, modalNotice, customer?.id, selectedContractApiId]);

  function handleSignNow(signature) {
    if (!signature?.signUrl) {
      return;
    }
    window.open(signature.signUrl, "_blank", "noopener,noreferrer");
    if (selectedContractApiId) {
      void logSignatureEvent(selectedContractApiId, signature.id, "sign_redirect").catch(() => {});
    }
  }

  function handleCloseSignatureModal() {
    setSignatureModalOpen(false);
  }

  function handleViewAllSignatures() {
    setSignatureModalOpen(false);
    navigate("/cliente/assinaturas");
  }

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    // Troca de contrato (ou a primeira selecao, inofensiva pois ja esta
    // tudo vazio) -- limpa TUDO que e especifico do contrato anterior ANTES
    // do efeito de busca abaixo comecar a buscar os dados do novo. Sem
    // isso, o contrato selecionado no topo ja muda na hora (vem de
    // `contracts`, carregado no login), mas conexao/boleto/chamados/avisos
    // continuavam mostrando o contrato anterior durante os 1-4s tipicos de
    // latencia do SGP, dando a impressao de que os dados se misturaram
    // entre contratos.
    setConnection(null);
    setBilling(null);
    setInvoiceData(null);
    setInvoicesError("");
    setPromiseStatus(null);
    setTickets([]);
    setCurrentTicket(null);
    setSignatureData(null);
    setNotices([]);
    setDataError("");
  }, [selectedContractApiId]);

  useEffect(() => {
    if (authenticated && selectedContractApiId) {
      void refreshCustomerData();
    }
  }, [authenticated, refreshCustomerData, selectedContractApiId]);

  useEffect(() => {
    if (authenticated && selectedContractApiId && (pageKey === "faturas" || pageKey === "inicio")) {
      void refreshInvoices();
    }
  }, [authenticated, pageKey, refreshInvoices, selectedContractApiId]);

  useEffect(() => {
    if (authenticated && selectedContractApiId && pageKey === "faturas") {
      void refreshPromiseStatus();
    }
  }, [authenticated, pageKey, refreshPromiseStatus, selectedContractApiId]);

  function handleAuthenticated(response) {
    const nextContracts = Array.isArray(response.contracts) ? response.contracts : [];
    const storedContractId = readSelectedContractId(response.customer?.id);
    const nextContractId = pickDefaultContractId(nextContracts, storedContractId);

    // Cancela qualquer requisicao ainda em andamento de uma sessao anterior
    // nesta mesma aba (ex.: login -> logout -> login rapido, ou sessao
    // anterior expirada sem passar por handleLogout) ANTES de aceitar o
    // novo cliente -- nunca deixar uma resposta antiga sobrescrever os
    // dados do cliente que acabou de autenticar.
    customerDataAbortRef.current?.abort();
    invoicesAbortRef.current?.abort();
    promiseStatusAbortRef.current?.abort();

    // Reset completo do estado do cliente anterior ANTES de carregar os
    // dados do novo: nunca manter na tela conexao/boleto/chamados/avisos/
    // assinaturas de quem autenticou antes nesta mesma aba enquanto os
    // dados do cliente novo ainda estao carregando.
    setConnection(null);
    setBilling(null);
    setInvoiceData(null);
    setInvoicesError("");
    setPromiseStatus(null);
    setTickets([]);
    setCurrentTicket(null);
    setCategories([]);
    setSignatureData(null);
    setSignatureModalOpen(false);
    setNotices([]);
    setDismissedNoticeKeys(new Set());
    recordedNoticeViewsRef.current = new Set();
    setDataError("");
    clearSignatureModalSessionState();

    setCustomer(response.customer);
    setContracts(nextContracts);
    setSelectedContractId(nextContractId);
    saveSelectedContractId(response.customer?.id, nextContractId);
    navigate("/cliente", { replace: true });
  }

  async function handleLogout() {
    customerDataAbortRef.current?.abort();
    invoicesAbortRef.current?.abort();
    promiseStatusAbortRef.current?.abort();

    try {
      const { accessToken } = readTokens();
      if (accessToken) {
        await logoutCustomer(accessToken);
      }
    } catch {
      // Token cleanup is local and must happen even if the remote session expired.
    } finally {
      clearTokens();
      setCustomer(null);
      setContracts([]);
      setSelectedContractId("");
      setConnection(null);
      setBilling(null);
      setInvoiceData(null);
      setInvoicesError("");
      setPromiseStatus(null);
      setTickets([]);
      setCurrentTicket(null);
      setCategories([]);
      setSignatureData(null);
      setSignatureModalOpen(false);
      setNotices([]);
      setDataError("");
      // Sem isso, login -> logout -> login na mesma aba nunca reabriria o
      // modal de assinatura pendente, mesmo com pendencia real (o SGP e
      // sempre a fonte da verdade, nunca o navegador).
      clearSignatureModalSessionState();
      navigate("/cliente/login", { replace: true });
    }
  }

  if (bootstrapping) {
    return <ClienteLoadingScreen />;
  }

  if (!authenticated) {
    return <ClienteLogin onAuthenticated={handleAuthenticated} />;
  }

  return (
    <>
      {modalNotice ? (
        <NoticeModal notice={modalNotice} onDismiss={handleDismissNotice} />
      ) : (
        <SignaturePendingModal
          open={signatureModalOpen}
          signatures={pendingSignatures}
          onClose={handleCloseSignatureModal}
          onSignNow={handleSignNow}
          onViewAll={handleViewAllSignatures}
        />
      )}
	      <ClienteShell
	        connection={connection}
	        customer={customer}
	        contracts={contracts}
        pageKey={pageKey}
        selectedContract={selectedContract}
        selectedContractId={selectedContractId}
        menuOpen={menuOpen}
        onCloseMenu={() => setMenuOpen(false)}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onSelectContract={setSelectedContract}
        onLogout={handleLogout}
      >
      <Helmet>
        <title>Área do Cliente | AcessaNet</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      {bannerNotices.length > 0 ? (
        <div className="central-notice-banner-stack">
          {bannerNotices.map((notice) => (
            <NoticeBanner key={notice.id} notice={notice} onDismiss={handleDismissNotice} />
          ))}
        </div>
      ) : null}

      {selectedContractApiId ? <NetworkIncidentBanner contractId={selectedContractApiId} /> : null}

      {dataError ? (
        <InlineNotice tone="danger" title="Dados indisponíveis" message={dataError} />
      ) : null}

      {pageKey === "inicio" ? null : (
        <PageToolbar
          pageKey={pageKey}
          dataLoading={dataLoading || (pageKey === "faturas" && invoicesLoading)}
          onRefresh={refreshPageData}
        />
      )}

      {pageKey === "internet" ? (
        <InternetPage connection={connection} contract={selectedContract} loading={dataLoading} />
      ) : pageKey === "faturas" ? (
        <FaturasPage
          billing={billing}
          contract={selectedContract}
          error={invoicesError}
          invoiceData={invoiceData?.contractId === selectedContractApiId ? invoiceData : null}
          loading={dataLoading || invoicesLoading}
          onPromiseSuccess={handlePromiseSuccess}
          promiseStatus={promiseStatus}
          promiseStatusLoading={promiseStatusLoading}
        />
      ) : pageKey === "plano" ? (
        <PlanoPage contract={selectedContract} customer={customer} />
      ) : pageKey === "atendimento" ? (
        <AtendimentoPage
          categories={categories}
          connection={connection}
          currentTicket={currentTicket}
          loading={dataLoading}
          selectedContract={selectedContract}
          tickets={tickets}
          onRefresh={refreshCustomerData}
        />
      ) : pageKey === "chamados" ? (
        <ChamadosPage currentTicket={currentTicket} tickets={tickets} loading={dataLoading} />
      ) : pageKey === "assinaturas" && SIGNATURES_FEATURE_ENABLED ? (
        <AssinaturasPage
          data={signatureData}
          loading={dataLoading}
          onRefresh={refreshCustomerData}
          onSignNow={handleSignNow}
        />
      ) : pageKey === "perfil" ? (
        <PerfilPage
          customer={customer}
          contracts={contracts}
          selectedContractId={selectedContractId}
          onSelectContract={setSelectedContract}
          onLogout={handleLogout}
        />
      ) : (
        <ClienteHome
          billing={billing}
          connection={connection}
          contract={selectedContract}
          currentTicket={currentTicket}
          customer={customer}
          invoiceData={invoiceData?.contractId === selectedContractApiId ? invoiceData : null}
          loading={dataLoading}
          invoicesLoading={invoicesLoading}
          noticeCards={cardNotices}
          onRefresh={refreshPageData}
          onSignNow={handleSignNow}
          pendingSignatures={pendingSignatures}
          tickets={tickets}
        />
      )}
      </ClienteShell>
    </>
  );
}

const OTP_RESEND_COOLDOWN_SECONDS = 60;
const GENERIC_FORGOT_PASSWORD_NOTICE = "Enviamos um código de verificação, caso os dados informados estejam cadastrados.";

function ClienteLogin({ onAuthenticated }) {
  const [step, setStep] = useState("cpf");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [resetCpf, setResetCpf] = useState("");
  const [resetEmailNotice, setResetEmailNotice] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState("");

  useEffect(() => {
    document.body.classList.add("cliente-login-shell");

    return () => {
      document.body.classList.remove("cliente-login-shell");
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function handleCpfSubmit(event) {
    event.preventDefault();
    setError("");

    if (normalizeCpf(cpf).length !== 11) {
      setError("Digite um CPF válido.");
      return;
    }

    setLoading(true);
    try {
      const result = await checkLocalAccess(cpf);
      setStep(result?.hasPassword ? "password" : "setup");
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível continuar agora."));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setError("");

    if (!password) {
      setError("Digite sua senha.");
      return;
    }

    setLoading(true);
    try {
      const response = await loginLocal(cpf, password);
      onAuthenticated(response);
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível entrar agora."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupSubmit(event) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const response = await setupLocalPassword(cpf, newPassword, confirmPassword);
      onAuthenticated(response);
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível criar sua senha agora."));
    } finally {
      setLoading(false);
    }
  }

  function handleBackToCpf() {
    setStep("cpf");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  }

  function handleOpenForgotPassword() {
    setResetCpf(cpf);
    setResetEmailNotice("");
    setResetCode("");
    setResetToken("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResendNotice("");
    setError("");
    setStep("forgot-cpf");
  }

  async function requestResetCode(targetCpf) {
    // Dispara os dois em paralelo: forgotPassword sempre "sucede" (mensagem
    // generica, nunca revela se o CPF existe). getMaskedEmailForReset e um
    // endpoint separado, so pra mostrar "lu***@gmail.com" na Etapa 2 -- se
    // falhar (CPF nao encontrado), cai no aviso generico, sem erro visivel.
    const [, maskedEmailResult] = await Promise.allSettled([
      forgotPassword(targetCpf),
      getMaskedEmailForReset(targetCpf)
    ]);

    if (maskedEmailResult.status === "fulfilled" && maskedEmailResult.value?.maskedEmail) {
      setResetEmailNotice(`Enviamos um código para ${maskedEmailResult.value.maskedEmail}`);
    } else {
      setResetEmailNotice(GENERIC_FORGOT_PASSWORD_NOTICE);
    }

    setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
  }

  async function handleForgotCpfSubmit(event) {
    event.preventDefault();
    setError("");

    if (normalizeCpf(resetCpf).length !== 11) {
      setError("Digite um CPF válido.");
      return;
    }

    setLoading(true);
    try {
      await requestResetCode(resetCpf);
      setStep("forgot-otp");
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível enviar o código agora."));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0 || loading) return;
    setError("");
    setResendNotice("");
    setLoading(true);
    try {
      await requestResetCode(resetCpf);
      setResetCode("");
      setResendNotice("Novo código enviado.");
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível reenviar o código agora."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCodeSubmit(event) {
    event.preventDefault();
    setError("");

    if (resetCode.length !== 6) {
      setError("Digite os 6 dígitos do código.");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyResetCode(resetCpf, resetCode);
      setResetToken(response.resetToken);
      setStep("forgot-new-password");
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível validar o código agora."));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPasswordSubmit(event) {
    event.preventDefault();
    setError("");

    if (resetNewPassword !== resetConfirmPassword) {
      setError("Nova senha e confirmação não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithToken(resetToken, resetNewPassword, resetConfirmPassword);
      setStep("forgot-success");
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível redefinir a senha agora."));
    } finally {
      setLoading(false);
    }
  }

  function handleBackToLoginAfterReset() {
    setCpf(resetCpf);
    setPassword("");
    setResetCpf("");
    setResetEmailNotice("");
    setResetCode("");
    setResetToken("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResendCooldown(0);
    setResendNotice("");
    setError("");
    setStep("cpf");
  }

  const headline =
    step === "cpf"
      ? "Acompanhe seu contrato AcessaNet com acesso seguro e atendimento integrado."
      : step === "setup"
        ? "Primeiro acesso: crie uma senha para proteger sua conta."
        : step === "password"
          ? "Digite sua senha para continuar."
          : step === "forgot-cpf"
            ? "Informe seu CPF para recuperar o acesso."
            : step === "forgot-otp"
              ? "Digite o código de verificação enviado por e-mail."
              : step === "forgot-new-password"
                ? "Crie uma nova senha para sua conta."
                : "Tudo certo!";

  return (
    <main className="login">
      <Helmet>
        <title>Entrar na Área do Cliente | AcessaNet</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="login-card">
        <Link to="/" className="login-logo" aria-label="AcessaNet">
          <img src={logoLight} alt="AcessaNet" />
        </Link>

        {seasonalCampaign.enabled && (
          <div className="login-campaign-chip">
            <Ribbon size={13} aria-hidden="true" />
            <span>Outubro Rosa • Conexão também é cuidado</span>
          </div>
        )}

        <div className="login-head">
          <h1>{step.startsWith("forgot") ? "Recuperar acesso" : "Área do Cliente"}</h1>
          <p>{headline}</p>
        </div>

        {step === "cpf" ? (
          <form className="login-form" onSubmit={handleCpfSubmit}>
            <label htmlFor="cliente-cpf">CPF do assinante</label>
            <input
              id="cliente-cpf"
              inputMode="numeric"
              autoComplete="username"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(event) => {
                setError("");
                setCpf(maskCpf(event.target.value));
              }}
            />

            {error ? <p className="login-error">{error}</p> : null}

            <button className="home-btn home-btn-primary login-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="cliente-spin" /> : <ArrowRight size={18} />}
              {loading ? "Verificando..." : "Continuar"}
            </button>
          </form>
        ) : step === "setup" ? (
          <form className="login-form" onSubmit={handleSetupSubmit}>
            <div className="login-cpf-chip">
              <span>{maskCpf(cpf)}</span>
              <button type="button" onClick={handleBackToCpf}>
                Trocar
              </button>
            </div>

            <label htmlFor="cliente-new-password">Crie uma senha</label>
            <LoginPasswordField
              autoComplete="new-password"
              id="cliente-new-password"
              value={newPassword}
              onChange={(event) => {
                setError("");
                setNewPassword(event.target.value);
              }}
            />
            <p className="login-hint">Pelo menos 8 caracteres, com letras e números.</p>

            <label htmlFor="cliente-confirm-password">Confirme a senha</label>
            <LoginPasswordField
              autoComplete="new-password"
              id="cliente-confirm-password"
              value={confirmPassword}
              onChange={(event) => {
                setError("");
                setConfirmPassword(event.target.value);
              }}
            />

            {error ? <p className="login-error">{error}</p> : null}

            <button className="home-btn home-btn-primary login-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="cliente-spin" /> : <ShieldCheck size={18} />}
              {loading ? "Criando..." : "Criar senha e entrar"}
            </button>
          </form>
        ) : step === "password" ? (
          <form className="login-form" onSubmit={handlePasswordSubmit}>
            <div className="login-cpf-chip">
              <span>{maskCpf(cpf)}</span>
              <button type="button" onClick={handleBackToCpf}>
                Trocar
              </button>
            </div>

            <label htmlFor="cliente-password">Senha</label>
            <LoginPasswordField
              autoComplete="current-password"
              id="cliente-password"
              value={password}
              onChange={(event) => {
                setError("");
                setPassword(event.target.value);
              }}
            />

            {error ? <p className="login-error">{error}</p> : null}

            <button className="home-btn home-btn-primary login-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="cliente-spin" /> : <ShieldCheck size={18} />}
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <button type="button" className="login-link-forgot" onClick={handleOpenForgotPassword}>
              Esqueci minha senha
            </button>
          </form>
        ) : step === "forgot-cpf" ? (
          <form className="login-form" onSubmit={handleForgotCpfSubmit}>
            <label htmlFor="cliente-forgot-cpf">CPF do assinante</label>
            <input
              id="cliente-forgot-cpf"
              inputMode="numeric"
              autoComplete="username"
              placeholder="000.000.000-00"
              value={resetCpf}
              onChange={(event) => {
                setError("");
                setResetCpf(maskCpf(event.target.value));
              }}
            />

            {error ? <p className="login-error">{error}</p> : null}

            <button className="home-btn home-btn-primary login-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="cliente-spin" /> : <ArrowRight size={18} />}
              {loading ? "Enviando código..." : "Continuar"}
            </button>

            <button type="button" className="login-link-forgot" onClick={handleBackToCpf}>
              Voltar para o login
            </button>
          </form>
        ) : step === "forgot-otp" ? (
          <form className="login-form" onSubmit={handleVerifyCodeSubmit}>
            <div className="login-cpf-chip">
              <span>{maskCpf(resetCpf)}</span>
              <button type="button" onClick={() => setStep("forgot-cpf")}>
                Trocar
              </button>
            </div>

            <p className="login-hint">{resetEmailNotice}</p>

            <label htmlFor="cliente-reset-code">Código de verificação</label>
            <OtpInput id="cliente-reset-code" value={resetCode} onChange={setResetCode} disabled={loading} />

            {error ? <p className="login-error">{error}</p> : null}
            {!error && resendNotice ? <p className="login-hint">{resendNotice}</p> : null}

            <button className="home-btn home-btn-primary login-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="cliente-spin" /> : <ShieldCheck size={18} />}
              {loading ? "Validando..." : "Confirmar código"}
            </button>

            <button
              type="button"
              className="login-link-forgot"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || loading}
            >
              {resendCooldown > 0 ? `Reenviar código em ${resendCooldown}s` : "Reenviar código"}
            </button>
          </form>
        ) : step === "forgot-new-password" ? (
          <form className="login-form" onSubmit={handleResetPasswordSubmit}>
            <label htmlFor="cliente-reset-new-password">Nova senha</label>
            <LoginPasswordField
              autoComplete="new-password"
              id="cliente-reset-new-password"
              value={resetNewPassword}
              onChange={(event) => {
                setError("");
                setResetNewPassword(event.target.value);
              }}
            />
            <p className="login-hint">Pelo menos 8 caracteres, com letras e números.</p>

            <label htmlFor="cliente-reset-confirm-password">Confirme a nova senha</label>
            <LoginPasswordField
              autoComplete="new-password"
              id="cliente-reset-confirm-password"
              value={resetConfirmPassword}
              onChange={(event) => {
                setError("");
                setResetConfirmPassword(event.target.value);
              }}
            />

            {error ? <p className="login-error">{error}</p> : null}

            <button className="home-btn home-btn-primary login-submit" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="cliente-spin" /> : <KeyRound size={18} />}
              {loading ? "Alterando..." : "Redefinir senha"}
            </button>
          </form>
        ) : (
          <div className="login-form login-success">
            <CheckCircle2 size={40} className="login-success-icon" />
            <p>Sua senha foi redefinida com sucesso.</p>

            <button
              className="home-btn home-btn-primary login-submit"
              type="button"
              onClick={handleBackToLoginAfterReset}
            >
              <ArrowRight size={18} />
              Entrar
            </button>
          </div>
        )}

        <div className="login-footnote">
          <ShieldCheck size={15} />
          <span>Sessão protegida por AcessaNet.</span>
        </div>
      </div>

      <Link to="/" className="login-back">
        <ArrowLeft size={15} />
        Voltar para o site
      </Link>
    </main>
  );
}

/** Input de 6 digitos (OTP): caixas separadas, com avanco/retrocesso automatico, colar codigo completo e teclado numerico no mobile. */
function OtpInput({ id, value, onChange, disabled }) {
  const length = 6;
  const digitsArray = value.split("").concat(Array(length).fill("")).slice(0, length);
  const inputRefs = useRef([]);

  function handleChange(index, event) {
    const raw = event.target.value.replace(/[^0-9]/g, "");

    if (!raw) {
      const next = digitsArray.slice();
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    // Pode chegar mais de um digito de uma vez (autofill/colar rapido): distribui a partir daqui.
    const next = digitsArray.slice();
    let cursor = index;
    for (const char of raw) {
      if (cursor >= length) break;
      next[cursor] = char;
      cursor += 1;
    }
    onChange(next.join(""));
    inputRefs.current[Math.min(cursor, length - 1)]?.focus();
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace" && !digitsArray[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div className="login-otp-input" role="group" aria-label="Código de verificação de 6 dígitos">
      {digitsArray.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          id={index === 0 ? id : undefined}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          aria-label={`Dígito ${index + 1} de ${length}`}
        />
      ))}
    </div>
  );
}

function LoginPasswordField({ autoComplete, id, onChange, value }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="login-password-field">
      <input
        autoComplete={autoComplete}
        id={id}
        placeholder="••••••••"
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
      />
      <button
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className="login-password-toggle"
        type="button"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function contractStatusTone(status) {
  if (status === "ACTIVE") return "green";
  if (status === "SUSPENDED") return "amber";
  return "slate";
}

/**
 * Contrato padrao quando o CPF tem mais de um: 1) respeita a selecao salva
 * se ela ainda existir na lista atual; 2) senao, prioriza um contrato ATIVO
 * (nunca abrir direto num contrato cancelado so porque veio primeiro na
 * resposta do SGP); 3) senao, o primeiro da lista.
 */
function pickDefaultContractId(contracts, preferredId) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return "";
  }

  const preferred = contracts.find((contract) => contract.id === preferredId);
  if (preferred) {
    return preferred.id;
  }

  const active = contracts.find((contract) => contract.status === "ACTIVE");
  return (active || contracts[0]).id;
}

/**
 * Seletor de contrato do topo da Central -- so aparece quando o CPF tem mais
 * de um contrato (ClienteShell mantem o chip simples pro caso de 1 contrato
 * so). Mostra id + status + plano de cada contrato, nunca so o endereco
 * (endereco pode ser igual pra contratos diferentes no mesmo imovel/predio).
 * Dropdown proprio em vez de <select> nativo porque select nao permite
 * estilizar a bolinha de status dentro de cada opcao.
 */
function ContractSwitcher({ contracts, onSelectContract, selectedContractId }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = contracts.find((contract) => contract.id === selectedContractId) || contracts[0];

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="cliente-contract-switcher" ref={containerRef}>
      <button
        type="button"
        className="cliente-contract-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`cliente-contract-dot tone-${contractStatusTone(selected?.status)}`} aria-hidden="true" />
        <span className="cliente-contract-switcher-text">
          <strong>Contrato {selected?.id}</strong>
          <small>
            {contractStatusLabel(selected?.status)}
            {selected?.planName ? ` • ${selected.planName}` : ""}
          </small>
        </span>
        <ChevronDown size={15} />
      </button>

      {open ? (
        <ul className="cliente-contract-switcher-list" role="listbox">
          {contracts.map((contract) => (
            <li key={contract.id} role="option" aria-selected={contract.id === selectedContractId}>
              <button
                type="button"
                className={contract.id === selectedContractId ? "is-selected" : ""}
                onClick={() => {
                  onSelectContract(contract.id);
                  setOpen(false);
                }}
              >
                <span className={`cliente-contract-dot tone-${contractStatusTone(contract.status)}`} aria-hidden="true" />
                <span className="cliente-contract-switcher-text">
                  <strong>Contrato {contract.id}</strong>
                  <small>
                    {contractStatusLabel(contract.status)}
                    {contract.planName ? ` • ${contract.planName}` : ""}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ClienteShell({
  children,
  connection,
  contracts,
  customer,
  menuOpen,
  onCloseMenu,
  onLogout,
  onSelectContract,
  onToggleMenu,
  pageKey,
  selectedContract,
  selectedContractId
}) {
  const location = useLocation();
  const [bugModalOpen, setBugModalOpen] = useState(false);

  return (
    <main className="cliente-app">
      <aside className={`cliente-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="cliente-sidebar-head">
          <Link to="/" className="cliente-brand" onClick={onCloseMenu}>
            <img src={logo} alt="AcessaNet" />
          </Link>
          <button className="cliente-icon-button cliente-mobile-only" type="button" onClick={onCloseMenu}>
            <X size={19} />
          </button>
        </div>

        <nav className="cliente-nav" aria-label="Navegação da Área do Cliente">
          {navItems
            .filter((item) => SIGNATURES_FEATURE_ENABLED || item.to !== "/cliente/assinaturas")
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={onCloseMenu} />
            ))}
        </nav>

        <div className="cliente-sidebar-footer">
          <span>{customer?.name || "Cliente"}</span>
          <button type="button" onClick={onLogout}>
            <LogOut size={16} />
            Encerrar sessão
          </button>
        </div>
      </aside>

      {menuOpen ? <button className="cliente-scrim" type="button" onClick={onCloseMenu} aria-label="Fechar menu" /> : null}

      <section className="cliente-main">
        <header className="cliente-topbar">
          <button className="cliente-icon-button cliente-mobile-only" type="button" onClick={onToggleMenu}>
            <Menu size={20} />
          </button>

          <div className="cliente-topbar-title">
            {pageKey === "inicio" ? null : (
              <>
                <span>Olá, {firstName(customer?.name)}</span>
                <strong>{selectedContract?.planName || "Área do Cliente"}</strong>
              </>
            )}
          </div>

          {contracts.length > 1 ? (
            <ContractSwitcher
              contracts={contracts}
              selectedContractId={selectedContractId}
              onSelectContract={onSelectContract}
            />
          ) : (
            <div className="cliente-contract-chip">
              <Router size={16} />
              <span>{selectedContract?.addressLine || "Contrato ativo"}</span>
            </div>
          )}
        </header>

        <div className="cliente-content">{children}</div>
      </section>

	      <nav className="cliente-bottom-nav" aria-label="Navegação rápida">
	        {mobileNavItems.map((item) => (
	          <NavItem compact key={item.to} item={item} />
	        ))}
	      </nav>

	      <button className="cliente-bug-fab" type="button" onClick={() => setBugModalOpen(true)}>
	        <Bug size={16} />
	        <span>Relatar bug</span>
	      </button>

	      {bugModalOpen ? (
	        <ReportBugModal
	          connection={connection}
	          contracts={contracts}
	          location={location}
	          onClose={() => setBugModalOpen(false)}
	          pageKey={pageKey}
	          selectedContract={selectedContract}
	        />
	      ) : null}
	    </main>
	  );
	}

function getFrontendVersion() {
  return typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown";
}

function buildBugClientContext({ connection, contracts, location, pageKey, selectedContract }) {
  const screenValue = typeof window === "undefined" ? null : `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  return {
    rotaAtual: location.pathname,
    paginaAtual: pageKey,
    urlAtual: typeof window === "undefined" ? "" : window.location.href,
    resolucaoTela: screenValue,
    ambiente: import.meta.env.MODE,
    versaoFrontend: getFrontendVersion(),
    contratoSelecionado: selectedContract?.id || null,
    contratosDoCliente: contracts.map((contract) => ({
      id: contract.id,
      status: contract.status,
      planName: contract.planName,
      city: contract.city,
      state: contract.state
    })),
    statusConexaoExibido: connection?.health || null,
    statusContratoExibido: selectedContract?.status || null,
    planoExibido: selectedContract?.planName || null
  };
}

function ReportBugModal({ connection, contracts, location, onClose, pageKey, selectedContract }) {
  const [category, setCategory] = useState(bugReportCategories[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (description.trim().length < 10) {
      setError("Descreva o problema com pelo menos 10 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      await createBugReport({
        category,
        description,
        contractId: selectedContract?.id || undefined,
        page: location.pathname,
        url: typeof window === "undefined" ? "" : window.location.href,
        frontendVersion: getFrontendVersion(),
        clientContext: buildBugClientContext({ connection, contracts, location, pageKey, selectedContract })
      });
      setSuccess(true);
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível enviar o relatório agora."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cliente-bug-modal-backdrop" role="presentation" onClick={success ? onClose : undefined}>
      <div className="cliente-bug-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="cliente-bug-modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
        <div className="cliente-bug-modal-head">
          <span><Bug size={18} /></span>
          <div>
            <h2>Relatar um problema</h2>
            <p>Encontrou algum problema na Central do Assinante? Conte para nós o que aconteceu.</p>
          </div>
        </div>

        {success ? (
          <div className="cliente-bug-success">
            <CheckCircle2 size={30} />
            <strong>Relatório enviado!</strong>
            <p>Obrigado por nos avisar. Nossa equipe irá analisar o problema.</p>
            <button className="cliente-bug-submit" type="button" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <form className="cliente-bug-form" onSubmit={handleSubmit}>
            {error ? <InlineNotice tone="danger" title="Não foi possível enviar" message={error} /> : null}
            <label>
              <span>Categoria</span>
              <select required value={category} onChange={(event) => setCategory(event.target.value)}>
                {bugReportCategories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Descrição</span>
              <textarea
                required
                minLength={10}
                maxLength={3000}
                rows={7}
                placeholder="Descreva o problema encontrado. Se possível, informe o que você estava tentando fazer quando o erro aconteceu."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <small>{description.length}/3000</small>
            </label>
            <div className="cliente-bug-actions">
              <button className="cliente-bug-cancel" type="button" onClick={onClose}>Cancelar</button>
              <button className="cliente-bug-submit" type="submit" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar relatório"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function NavItem({ compact = false, item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.exact}
      onClick={onClick}
      className={({ isActive }) => `cliente-nav-item ${compact ? "is-compact" : ""} ${isActive ? "is-active" : ""}`}
    >
      <Icon size={compact ? 20 : 18} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function PageToolbar({ dataLoading, onRefresh, pageKey }) {
  const pageTitle = pageTitles[pageKey] || { eyebrow: "Área do Cliente", title: "Início" };

  return (
    <div className={`cliente-page-toolbar ${pageTitle.description ? "has-description" : ""}`}>
      <div>
        <span>{pageTitle.eyebrow}</span>
        <h2>{pageTitle.title}</h2>
        {pageTitle.description ? <p>{pageTitle.description}</p> : null}
      </div>
      <button className="cliente-soft-action" type="button" onClick={onRefresh} disabled={dataLoading}>
        <RefreshCw size={17} className={dataLoading ? "cliente-spin" : ""} />
        <span className="cliente-action-label">Atualizar</span>
      </button>
    </div>
  );
}

function ClienteHome({
  billing,
  connection,
  contract,
  currentTicket,
  customer,
  invoiceData,
  invoicesLoading,
  loading,
  noticeCards,
  onRefresh,
  onSignNow,
  pendingSignatures = [],
  tickets
}) {
  const activeTicket = getActiveTicket(currentTicket, tickets, contract?.id);
  const offline = isOfflineConnection(connection, contract);
  const payableInvoice = getNextPayableInvoice(invoiceData);
  const announcements = useMemo(
    () => buildHomeAnnouncements({ connection, contract }),
    [connection, contract]
  );
  const benefits = Array.isArray(contract?.benefits) ? contract.benefits : [];
  const initialLoading = loading && !connection && !billing;

  return (
    <div className="home">
      <HomeHeader
        alertCount={announcements.length}
        customer={customer}
        onRefresh={onRefresh}
        refreshing={loading}
      />

      <div className="home-layout">
        <div className="home-main">
          {pendingSignatures.length > 0 ? (
            <SignaturePendingBanner
              count={pendingSignatures.length}
              onSignNow={() => onSignNow?.(pendingSignatures[0])}
            />
          ) : null}

          {initialLoading ? (
            <HomeSkeletonCard tall />
          ) : (
            <ConnectionHeroCard connection={connection} contract={contract} offline={offline} />
          )}

          {initialLoading ? (
            <HomeSkeletonCard />
          ) : (
            <InvoiceHighlightCard billing={billing} invoice={payableInvoice} loading={invoicesLoading} />
          )}

          {Array.isArray(noticeCards) && noticeCards.length > 0
            ? noticeCards.map((notice) => <NoticeCard key={notice.id} notice={notice} />)
            : null}

          <BenefitsSection benefits={benefits} />
        </div>

        <div className="home-side">
          <QuickActionsGrid hasActiveTicket={Boolean(activeTicket)} />
          <SupportSection activeTicket={activeTicket} />
          <AnnouncementsSection items={announcements} />
        </div>
      </div>
    </div>
  );
}

function HomeHeader({ alertCount, customer, onRefresh, refreshing }) {
  return (
    <header className="home-header">
      <div className="home-header-greeting">
        <span className="home-header-hello">Olá, {firstName(customer?.name)} 👋</span>
        <p>Tenha uma ótima experiência com sua AcessaNet.</p>
      </div>

      <div className="home-header-actions">
        <button
          aria-label="Atualizar dados"
          className="home-icon-button"
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw size={18} className={refreshing ? "cliente-spin" : ""} />
        </button>
        <a aria-label="Avisos" className="home-icon-button" href="#home-announcements">
          <Bell size={18} />
          {alertCount > 0 ? <span className="home-icon-badge">{alertCount}</span> : null}
        </a>
        <Link aria-label="Meu perfil" className="home-icon-button home-icon-button-profile" to="/cliente/perfil">
          <UserRound size={18} />
        </Link>
      </div>
    </header>
  );
}

function ConnectionHeroCard({ connection, contract, offline }) {
  const tone = connectionTone(connection, contract);
  const label = connectionLabel(connection, contract);
  const speed = parsePlanSpeed(contract?.planName);

  return (
    <section className={`home-card home-connection-card tone-${tone} ${offline ? "is-offline" : ""}`}>
      <div className="home-connection-top">
        <span className="home-card-eyebrow home-card-eyebrow-onlight">
          <Wifi size={16} />
          Sua internet
        </span>
        <span className="home-status-chip">
          <span className="home-status-dot" />
          {label}
        </span>
      </div>

      <strong className="home-connection-plan">
        {speed ? (
          <>
            {speed.value}
            <span className="home-connection-plan-unit">{speed.unit}</span>
          </>
        ) : (
          contract?.planName || "Plano não identificado"
        )}
      </strong>

      <p className="home-connection-address">
        {contract ? `${contract.addressLine}, ${contract.city} - ${contract.state}` : "Carregando dados do contrato"}
      </p>

      {offline ? (
        <div className="home-connection-alert">
          <AlertCircle size={18} />
          <p>Detectamos que sua conexão pode estar offline.</p>
        </div>
      ) : null}

      <div className="home-connection-footer">
        {offline ? (
          <Link className="home-btn home-btn-onlight" to="/cliente/atendimento">
            <Wrench size={16} />
            Solucionar problema
          </Link>
        ) : (
          <Link className="home-btn home-btn-text-onlight" to="/cliente/internet">
            Ver detalhes técnicos
            <ArrowUpRight size={15} />
          </Link>
        )}
      </div>
    </section>
  );
}

function InvoiceHighlightCard({ billing, invoice, loading }) {
  const [copied, setCopied] = useState(false);
  const status = billing?.status;
  const overdue = status === "OVERDUE";
  const amount = typeof invoice?.amount === "number" ? invoice.amount : billing?.amountOpen;
  const dueDate = invoice?.dueDate || billing?.nextDueDate;
  const lateDays = Number.isFinite(invoice?.daysLate) ? invoice.daysLate : billing?.maxDaysLate;
  const isPaidUp = status === "PAID" && typeof amount !== "number";
  const payHref = invoice?.pixUrl || invoice?.printUrl;

  async function handleCopyPix() {
    if (!invoice?.pixCopyPaste) return;
    const ok = await copyToClipboard(invoice.pixCopyPaste);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className={`home-card home-invoice-card ${overdue ? "is-overdue" : ""}`}>
      <div className="home-card-head">
        <span className="home-card-eyebrow">
          <CreditCard size={16} />
          Próxima fatura
        </span>
        {billing ? <span className={`home-badge tone-${billingTone(billing)}`}>{billingStatusLabel(status)}</span> : null}
      </div>

      {!billing && loading ? (
        <div className="home-skeleton-line home-skeleton-line-lg" />
      ) : isPaidUp ? (
        <strong className="home-invoice-amount home-invoice-amount-ok">Você está em dia 🎉</strong>
      ) : (
        <strong className="home-invoice-amount">{formatCurrency(amount) || "Indisponível"}</strong>
      )}

      {!isPaidUp ? (
        <p className="home-invoice-due">
          {dueDate
            ? `Vencimento em ${formatDate(dueDate)}`
            : billing?.dueDay
              ? `Vencimento todo dia ${billing.dueDay}`
              : "Sem vencimento em aberto"}
        </p>
      ) : null}

      {overdue && Number.isFinite(lateDays) && lateDays >= 5 ? (
        <>
          <div className="home-invoice-notice">
            <AlertCircle size={15} />
            Pagamento em atraso há {lateDays} {lateDays === 1 ? "dia" : "dias"}
          </div>
          <div className="home-invoice-notice home-invoice-notice-speed">
            <Gauge size={15} />
            Redução de velocidade pode ocorrer por atraso no pagamento
          </div>
        </>
      ) : null}

      <div className="home-invoice-actions">
        {!isPaidUp ? (
          payHref ? (
            <a className="home-btn home-btn-primary" href={payHref} rel="noopener noreferrer" target="_blank">
              Pagar fatura
            </a>
          ) : (
            <Link className="home-btn home-btn-primary" to="/cliente/faturas">
              Pagar fatura
            </Link>
          )
        ) : null}

        {invoice?.pixCopyPaste ? (
          <button className="home-btn home-btn-ghost" onClick={handleCopyPix} type="button">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Pix copiado" : "Copiar Pix"}
          </button>
        ) : null}

        <Link className="home-btn home-btn-text" to="/cliente/faturas">
          Ver faturas
          <ChevronRight size={15} />
        </Link>
      </div>
    </section>
  );
}

function BenefitsSection({ benefits }) {
  if (!benefits.length) {
    return null;
  }

  return (
    <section className="home-card home-benefits">
      <span className="home-card-eyebrow">
        <Sparkles size={16} />
        Seus benefícios
      </span>

      <div className="home-benefits-grid">
        {benefits.map((benefit) => (
          <div className="home-benefit-item" key={benefit.id || benefit.label}>
            <Sparkles size={16} />
            <span>{benefit.label || benefit.name}</span>
          </div>
        ))}
      </div>

      <Link className="home-btn home-btn-text" to="/cliente/plano">
        Ver todos os benefícios
        <ChevronRight size={15} />
      </Link>
    </section>
  );
}

function QuickActionsGrid({ hasActiveTicket }) {
  const actions = [
    { to: "/cliente/faturas", icon: ReceiptText, label: "2ª via" },
    { to: "/cliente/atendimento", icon: LifeBuoy, label: "Suporte" },
    { to: "/cliente/internet", icon: Wifi, label: "Internet" },
    { to: "/cliente/perfil", icon: UserRound, label: "Meus dados" },
    { to: "/cliente/plano", icon: BadgeCheck, label: "Meus serviços" },
    { to: "/cliente/chamados", icon: Ticket, label: "Chamados", badge: hasActiveTicket }
  ];

  return (
    <section className="home-card home-quick-actions">
      <span className="home-card-eyebrow">Acesso rápido</span>
      <div className="home-quick-grid">
        {actions.map((action) => (
          <Link className="home-quick-item" key={action.label} to={action.to}>
            <span className="home-quick-icon">
              <action.icon size={19} />
              {action.badge ? <span className="home-quick-dot" /> : null}
            </span>
            <span>{action.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SupportSection({ activeTicket }) {
  return (
    <section className="home-card home-support">
      <span className="home-card-eyebrow">
        <LifeBuoy size={16} />
        Precisando de ajuda?
      </span>
      <p>Resolva problemas da sua conexão ou fale com nosso suporte.</p>

      <div className="home-support-actions">
        <Link className="home-btn home-btn-primary" to="/cliente/atendimento">
          {activeTicket ? "Continuar atendimento" : "Iniciar atendimento"}
        </Link>
        <Link className="home-btn home-btn-ghost" to="/cliente/chamados">
          Meus chamados
        </Link>
      </div>
    </section>
  );
}

function AnnouncementsSection({ items }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="home-card home-announcements" id="home-announcements">
      <span className="home-card-eyebrow">
        <Megaphone size={16} />
        Avisos
      </span>

      <div className="home-announcements-list">
        {items.map((item) => (
          <div className={`home-announcement-item tone-${item.tone}`} key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HomeSkeletonCard({ tall = false }) {
  return (
    <div aria-hidden="true" className={`home-card home-skeleton-card ${tall ? "is-tall" : ""}`}>
      <div className="home-skeleton-line home-skeleton-line-sm" />
      <div className="home-skeleton-line home-skeleton-line-lg" />
      <div className="home-skeleton-line home-skeleton-line-md" />
    </div>
  );
}

function getNextPayableInvoice(invoiceData) {
  const invoices = Array.isArray(invoiceData?.invoices) ? invoiceData.invoices : [];
  const overdue = invoices.find((invoice) => invoice.status === "OVERDUE");
  if (overdue) return overdue;
  return invoices.find((invoice) => invoice.status === "OPEN") || null;
}

function buildHomeAnnouncements({ connection, contract }) {
  const items = [];

  if (connection?.knownIncident) {
    items.push({
      id: "incident",
      tone: "amber",
      title: "Instabilidade identificada",
      message: "Nossa equipe já está atuando em um incidente conhecido na sua região."
    });
  }

  if (contract && contract.status !== "ACTIVE") {
    items.push({
      id: "contract",
      tone: "red",
      title: "Contrato com pendência",
      message: `Situação atual: ${contractStatusLabel(contract.status)}.`
    });
  }

  return items;
}

function parsePlanSpeed(planName) {
  const match = String(planName || "").match(/(\d+)\s*(mega|giga|mb|gb)/i);
  if (!match) return null;

  const unitRaw = match[2].toLowerCase();
  const unit = unitRaw.startsWith("g") ? "GIGA" : "MEGA";
  return { value: match[1], unit };
}

function InternetPage({ connection, contract, loading }) {
  return (
    <div className="cliente-page-grid">
      <section className="cliente-panel cliente-panel-strong">
        <div className="cliente-panel-head">
          <Wifi size={22} />
          <div>
            <span>Status da conexão</span>
            <h3>{connectionLabel(connection, contract)}</h3>
          </div>
        </div>
        <p>{connectionDetail(connection, contract)}</p>
        {loading ? <p className="cliente-muted">Atualizando dados técnicos...</p> : null}
      </section>

      <section className="cliente-panel">
        <h3>Dados técnicos</h3>
        <InfoList
          items={[
            ["Contrato", contract?.id],
            ["Plano", contract?.planName],
            ["Status do contrato", contractStatusLabel(connection?.contractStatus || contract?.status)],
            ["ONU", technicalLabel(connection?.onu)],
            ["PON", technicalLabel(connection?.pon)],
            ["PPPoE", technicalLabel(connection?.pppoe)],
            ["Sinal óptico", opticalLabel(connection?.opticalSignal)],
            ["Incidente conhecido", connection?.knownIncident ? "Sim" : connection ? "Não" : undefined],
            ["Fonte do diagnóstico", connection?.statusSource ? statusSourceLabel(connection.statusSource) : undefined],
            ["Atualizado em", formatDateTime(connection?.updatedAt)]
          ]}
        />
      </section>
    </div>
  );
}

function FaturasPage({ billing, contract, error, invoiceData, loading, onPromiseSuccess, promiseStatus, promiseStatusLoading }) {
  const [selectedStatus, setSelectedStatus] = useState("OPEN");
  const [copiedAction, setCopiedAction] = useState("");
  const [promiseInvoice, setPromiseInvoice] = useState(null);
  const invoices = useMemo(
    () => (Array.isArray(invoiceData?.invoices) ? invoiceData.invoices : []),
    [invoiceData]
  );
  const groupedInvoices = useMemo(
    () => ({
      OPEN: invoices.filter((invoice) => invoice.status === "OPEN"),
      OVERDUE: invoices.filter((invoice) => invoice.status === "OVERDUE"),
      PAID: invoices.filter((invoice) => invoice.status === "PAID")
    }),
    [invoices]
  );
  const payableInvoices = [...groupedInvoices.OVERDUE, ...groupedInvoices.OPEN];
  const payableTotal = payableInvoices.reduce(
    (total, invoice) => total + (typeof invoice.amount === "number" ? invoice.amount : 0),
    0
  );
  const summaryValue = invoiceData
    ? payableInvoices.length > 0
      ? formatCurrency(payableTotal)
      : "Em dia"
    : billingValue(billing);
  const summaryDetail = invoiceData
    ? invoiceListSummary(groupedInvoices)
    : billingDetail(billing);
  const visibleInvoices = groupedInvoices[selectedStatus] || [];

  async function handleCopy(value, actionId) {
    const copied = await copyToClipboard(value);
    if (!copied) return;

    const isPix = actionId.endsWith(":pix");
    void recordCentralActivity({
      eventType: isPix ? "GENERATE_PIX" : "DOWNLOAD_INVOICE",
      page: "faturas",
      contractId: contract?.id,
      metadata: { method: isPix ? "copy_pix" : "copy_barcode" }
    }).catch(() => {});

    setCopiedAction(actionId);
    window.setTimeout(() => {
      setCopiedAction((current) => (current === actionId ? "" : current));
    }, 1800);
  }

  function handleInvoiceAction(eventType, method) {
    void recordCentralActivity({
      eventType,
      page: "faturas",
      contractId: contract?.id,
      metadata: { method }
    }).catch(() => {});
  }

  return (
    <div className="cliente-invoice-page">
      <section className="cliente-panel cliente-panel-strong cliente-invoice-summary">
        <div className="cliente-panel-head">
          <CircleDollarSign size={22} />
          <div>
            <span>Resumo financeiro</span>
            <h3>{summaryValue}</h3>
          </div>
        </div>
        <div className="cliente-invoice-summary-meta">
          <span>Contrato {contract?.id || "indisponível"}</span>
          <span>{summaryDetail}</span>
        </div>
      </section>

      {error ? <InlineNotice tone="danger" title="Faturas indisponíveis" message={error} /> : null}
      {invoiceData?.source === "unavailable" ? (
        <InlineNotice
          tone="danger"
          title="Consulta indisponível"
          message="Não foi possível consultar as faturas no SGP agora. Tente atualizar em instantes."
        />
      ) : null}

      {!promiseStatusLoading && promiseStatus ? (
        <section className="cliente-panel promise-status-card" aria-labelledby="promise-status-title">
          <div className="cliente-panel-head">
            <HandCoins size={22} />
            <div>
              <span>Promessa de pagamento ativa</span>
              <h3 id="promise-status-title">Serviço liberado temporariamente</h3>
            </div>
          </div>
          <dl className="promise-status-details">
            <div>
              <dt>Solicitada em</dt>
              <dd>{formatDateTime(promiseStatus.requestedAt)}</dd>
            </div>
            {promiseStatus.protocol ? (
              <div>
                <dt>Protocolo</dt>
                <dd>{promiseStatus.protocol}</dd>
              </div>
            ) : null}
            {typeof promiseStatus.releasedDays === "number" ? (
              <div>
                <dt>Liberação temporária</dt>
                <dd>
                  {promiseStatus.releasedDays} {promiseStatus.releasedDays === 1 ? "dia" : "dias"}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="promise-status-note">
            Atenção: a fatura permanece em aberto até o pagamento.
          </p>
        </section>
      ) : null}

      <section className="cliente-invoice-section" aria-labelledby="cliente-invoice-list-title">
        <div className="cliente-section-heading cliente-invoice-heading">
          <div>
            <span>Histórico financeiro</span>
            <h3 id="cliente-invoice-list-title">Faturas do contrato</h3>
          </div>
          {invoiceData?.updatedAt ? <small>Atualizado em {formatDateTime(invoiceData.updatedAt)}</small> : null}
        </div>

        <div className="cliente-invoice-tabs" role="tablist" aria-label="Status das faturas">
          {[
            ["OPEN", "Em aberto"],
            ["OVERDUE", "Atrasadas/Vencidas"],
            ["PAID", "Pagas"]
          ].map(([status, label]) => (
            <button
              aria-controls={`cliente-invoices-${status.toLowerCase()}`}
              aria-selected={selectedStatus === status}
              className={selectedStatus === status ? "is-active" : ""}
              key={status}
              onClick={() => setSelectedStatus(status)}
              role="tab"
              type="button"
            >
              <span>{label}</span>
              <strong>{groupedInvoices[status].length}</strong>
            </button>
          ))}
        </div>

        {loading && !invoiceData ? <LoadingInline label="Consultando faturas no SGP" /> : null}

        {!loading && invoiceData && invoices.length === 0 ? (
          <div className="cliente-invoice-empty">
            <ReceiptText size={24} />
            <strong>Nenhuma fatura encontrada</strong>
            <span>O SGP não retornou faturas para este contrato.</span>
          </div>
        ) : null}

        {invoiceData && invoices.length > 0 ? (
          <div
            className="cliente-invoice-grid"
            id={`cliente-invoices-${selectedStatus.toLowerCase()}`}
            role="tabpanel"
          >
            {visibleInvoices.length > 0 ? (
              visibleInvoices.map((invoice) => (
                <InvoiceCard
                  copiedAction={copiedAction}
                  invoice={invoice}
                  key={invoice.id}
                  onInvoiceAction={handleInvoiceAction}
                  onCopy={handleCopy}
                  onRequestPromise={() => setPromiseInvoice(invoice)}
                />
              ))
            ) : (
              <div className="cliente-invoice-empty">
                <CheckCircle2 size={24} />
                <strong>{invoiceEmptyTitle(selectedStatus)}</strong>
                <span>{invoiceEmptyDescription(selectedStatus)}</span>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <PaymentPromiseModal
        contractId={contract?.id}
        invoice={promiseInvoice}
        open={Boolean(promiseInvoice)}
        onClose={() => setPromiseInvoice(null)}
        onSuccess={onPromiseSuccess}
      />
    </div>
  );
}

function InvoiceCard({ copiedAction, invoice, onCopy, onInvoiceAction, onRequestPromise }) {
  const isPaid = invoice.status === "PAID";
  const isOverdue = invoice.status === "OVERDUE";
  const lateNotice = invoiceLateNotice(invoice);
  const barcodeActionId = `${invoice.id}:barcode`;
  const pixActionId = `${invoice.id}:pix`;

  return (
    <article className={`cliente-invoice-card tone-${invoiceStatusTone(invoice.status)}`}>
      <div className="cliente-invoice-card-head">
        <div>
          <span>Boleto</span>
          <h4>
            Boleto: {invoice.number} - {formatDate(invoice.dueDate) || "sem vencimento"}
          </h4>
        </div>
        <span className={`cliente-invoice-status tone-${invoiceStatusTone(invoice.status)}`}>
          {invoiceStatusLabel(invoice.status)}
        </span>
      </div>

      <dl className="cliente-invoice-details">
        <div>
          <dt>Valor</dt>
          <dd>{formatCurrency(invoice.amount) || "Indisponível"}</dd>
        </div>
        <div>
          <dt>Vencimento</dt>
          <dd>{formatDate(invoice.dueDate) || "Indisponível"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{invoiceStatusLabel(invoice.status)}</dd>
        </div>
        <div>
          <dt>Número</dt>
          <dd>{invoice.number}</dd>
        </div>
        {isPaid && invoice.paidAt ? (
          <div>
            <dt>Pagamento</dt>
            <dd>{formatDate(invoice.paidAt)}</dd>
          </div>
        ) : null}
      </dl>

      {lateNotice ? (
        <div className={`cliente-invoice-delay-alert tone-${lateNotice.tone}`}>
          <AlertCircle size={19} />
          <strong>{lateNotice.message}</strong>
        </div>
      ) : null}

      {!isPaid && (invoice.printUrl || invoice.pixUrl || invoice.barcode || invoice.pixCopyPaste || isOverdue) ? (
        <div className="cliente-invoice-actions">
          {invoice.printUrl ? (
            <a
              href={invoice.printUrl}
              rel="noopener noreferrer"
              target="_blank"
              onClick={() => onInvoiceAction("DOWNLOAD_INVOICE", "print_url")}
            >
              <Printer size={17} />
              IMPRIMIR
            </a>
          ) : null}
          {invoice.pixUrl ? (
            <a
              href={invoice.pixUrl}
              rel="noopener noreferrer"
              target="_blank"
              onClick={() => onInvoiceAction("GENERATE_PIX", "pix_url")}
            >
              <QrCode size={17} />
              PIX
            </a>
          ) : null}
          {invoice.barcode ? (
            <button type="button" onClick={() => onCopy(invoice.barcode, barcodeActionId)}>
              {copiedAction === barcodeActionId ? <Check size={17} /> : <Copy size={17} />}
              {copiedAction === barcodeActionId ? "CÓDIGO COPIADO" : "COPIAR CÓDIGO DE BARRAS"}
            </button>
          ) : null}
          {invoice.pixCopyPaste ? (
            <button type="button" onClick={() => onCopy(invoice.pixCopyPaste, pixActionId)}>
              {copiedAction === pixActionId ? <Check size={17} /> : <Copy size={17} />}
              {copiedAction === pixActionId ? "PIX COPIADO" : "COPIAR CÓDIGO PIX"}
            </button>
          ) : null}
          {isOverdue ? (
            <button type="button" className="cliente-invoice-promise-action" onClick={onRequestPromise}>
              <HandCoins size={17} />
              FAZER PROMESSA DE PAGAMENTO
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function AssinaturasPage({ data, loading, onRefresh, onSignNow }) {
  const signatures = Array.isArray(data?.signatures) ? data.signatures : [];
  const isUnavailable = data?.source === "unavailable";

  return (
    <div className="cliente-signature-page">
      <section className="cliente-panel cliente-panel-strong">
        <div className="cliente-panel-head">
          <FileSignature size={22} />
          <div>
            <span>Minhas assinaturas</span>
            <h3>Consulte documentos que precisam da sua assinatura e acompanhe o andamento das solicitações.</h3>
          </div>
        </div>
        <button className="cliente-soft-action" type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={17} className={loading ? "cliente-spin" : ""} />
          <span className="cliente-action-label">Atualizar status</span>
        </button>
      </section>

      {isUnavailable ? (
        <InlineNotice
          tone="danger"
          title="Consulta indisponível"
          message="Não foi possível consultar suas assinaturas agora. Tente atualizar em instantes."
        />
      ) : null}

      {loading && !data ? <LoadingInline label="Consultando assinaturas" /> : null}

      {!loading && data && !isUnavailable && signatures.length === 0 ? (
        <div className="cliente-invoice-empty">
          <FileSignature size={24} />
          <strong>Nenhuma assinatura pendente</strong>
          <span>Você não possui documentos aguardando assinatura neste contrato.</span>
        </div>
      ) : null}

      {signatures.length > 0 ? (
        <div className="cliente-signature-grid">
          {signatures.map((signature) => (
            <SignatureCard key={signature.id} signature={signature} onSignNow={onSignNow} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SignatureCard({ signature, onSignNow }) {
  const tone = signatureStatusTone(signature.status);

  return (
    <article className={`cliente-signature-card tone-${tone}`}>
      <div className="cliente-signature-card-head">
        <div>
          <h4>{signature.title}</h4>
          <span>Contrato nº {signature.contractId}</span>
        </div>
        <span className={`cliente-signature-status tone-${tone}`}>{signature.statusLabel}</span>
      </div>

      <p>{signatureStatusDescription(signature.status)}</p>

      {signature.status === "pending" && signature.createdAt ? (
        <span className="cliente-signature-card-meta">Criado em {formatDate(signature.createdAt)}</span>
      ) : null}

      {(signature.status === "signed" || signature.status === "finished") && signature.signedAt ? (
        <span className="cliente-signature-card-meta">Assinado em {formatDateTime(signature.signedAt)}</span>
      ) : null}

      {signature.status === "pending" && signature.signUrl ? (
        <>
          <div className="cliente-signature-card-actions">
            <button className="is-primary" type="button" onClick={() => onSignNow?.(signature)}>
              <FileSignature size={16} />
              Assinar agora
            </button>
          </div>
          {signature.signKey ? (
            <span className="cliente-signature-card-meta">Código de verificação: {signature.signKey}</span>
          ) : null}
        </>
      ) : null}

      {(signature.status === "signed" || signature.status === "finished") && signature.documentUrl ? (
        <div className="cliente-signature-card-actions">
          <a
            href={signature.documentUrl}
            rel="noopener noreferrer"
            target="_blank"
            onClick={() => void logSignatureEvent(signature.contractId, signature.id, "document_view").catch(() => {})}
          >
            <Eye size={16} />
            Visualizar documento
          </a>
          <a href={signature.documentUrl} download rel="noopener noreferrer" target="_blank">
            <ArrowUpRight size={16} />
            Baixar documento
          </a>
        </div>
      ) : null}
    </article>
  );
}

function signatureStatusTone(status) {
  if (status === "signed" || status === "finished") return "green";
  if (status === "pending") return "amber";
  if (status === "awaiting_validation") return "blue";
  if (status === "expired") return "red";
  return "neutral";
}

function signatureStatusDescription(status) {
  switch (status) {
    case "pending":
      return "Este documento ainda precisa da sua assinatura.";
    case "awaiting_validation":
      return "Sua assinatura foi recebida e está aguardando validação.";
    case "signed":
    case "finished":
      return "Documento assinado com sucesso.";
    case "canceled":
      return "Este processo de assinatura foi cancelado.";
    case "expired":
      return "O prazo para esta assinatura expirou.";
    default:
      return "Status indisponível no momento.";
  }
}

function PlanoPage({ contract, customer }) {
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const viewTrackedRef = useRef(false);

  const currentSpeed = parsePlanSpeed(contract?.planName);
  const eligibleForUpgrade = isEligibleForUpgrade(currentSpeed);

  const currentPlan = {
    label: contract?.planName || "Plano atual",
    speedValue: currentSpeed?.value,
    speedUnit: currentSpeed?.unit,
    price: resolveCurrentPlanPrice(contract)
  };

  const recommendedPlan = {
    ...RECOMMENDED_PLAN,
    price: resolveRecommendedPlanPrice(contract)
  };

  const priceDifference = calculatePriceDifference(currentPlan.price, recommendedPlan.price);

  useEffect(() => {
    if (eligibleForUpgrade && !viewTrackedRef.current) {
      trackPlanUpgradeEvent(PLAN_UPGRADE_EVENTS.VIEW, { contractId: contract?.id });
      viewTrackedRef.current = true;
    }
  }, [eligibleForUpgrade, contract?.id]);

  function handleOpenUpgradeModal(source) {
    trackPlanUpgradeEvent(PLAN_UPGRADE_EVENTS.DETAILS_CLICK, { contractId: contract?.id, source });
    setUpgradeModalOpen(true);
    trackPlanUpgradeEvent(PLAN_UPGRADE_EVENTS.MODAL_OPEN, { contractId: contract?.id });
  }

  function handleCancelUpgrade() {
    trackPlanUpgradeEvent(PLAN_UPGRADE_EVENTS.CANCEL, { contractId: contract?.id });
    setUpgradeModalOpen(false);
  }

  function handleConfirmUpgrade() {
    trackPlanUpgradeEvent(PLAN_UPGRADE_EVENTS.START, { contractId: contract?.id });
    window.open(getPlanUpgradeWhatsappUrl(contract), "_blank", "noopener,noreferrer");
    setUpgradeModalOpen(false);
  }

  return (
    <div className="plano-page">
      {eligibleForUpgrade ? (
        <PlanUpgradeShowcase
          benefits={PLAN_UPGRADE_BENEFITS}
          currentPlan={currentPlan}
          onOpenModal={handleOpenUpgradeModal}
          priceDifference={priceDifference}
          recommendedPlan={recommendedPlan}
        />
      ) : (
        <section className="cliente-panel cliente-panel-strong plano-current-panel">
          <div className="cliente-panel-head">
            <BadgeCheck size={22} />
            <div>
              <span>Seu plano atual</span>
              <h3>{contract?.planName || "Indisponível"}</h3>
            </div>
          </div>
          <p>{contract ? `${contract.addressLine}, ${contract.city} - ${contract.state}` : "Selecione um contrato."}</p>
        </section>
      )}

      <section className="cliente-panel plano-contract-panel">
        <h3>Contrato</h3>
        <InfoList
          items={[
            ["Assinante", customer?.name],
            ["CPF", customer?.maskedCpf],
            ["Telefone", customer?.maskedPhone],
            ["Contrato", contract?.id],
            ["Status", contractStatusLabel(contract?.status)],
            ["Endereço", contract ? `${contract.addressLine}, ${contract.city} - ${contract.state}` : undefined]
          ]}
        />
      </section>

      {eligibleForUpgrade ? (
        <PlanUpgradeModal
          benefits={PLAN_UPGRADE_BENEFITS}
          currentPlan={currentPlan}
          onClose={handleCancelUpgrade}
          onConfirm={handleConfirmUpgrade}
          open={upgradeModalOpen}
          priceDifference={priceDifference}
          recommendedPlan={recommendedPlan}
        />
      ) : null}
    </div>
  );
}

function AtendimentoPage({ categories, connection, currentTicket, loading: dataLoading, onRefresh, selectedContract, tickets }) {
  const activeTicket = getActiveTicket(currentTicket, tickets, selectedContract?.id);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [diagnosis, setDiagnosis] = useState(null);
  const [answers, setAnswers] = useState({});
  const [answerTrail, setAnswerTrail] = useState([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [error, setError] = useState("");
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [contactPhone, setContactPhone] = useState("");

  const chatTicket = createdTicket || activeTicket;
  const orderedCategories = useMemo(() => orderAttendanceCategories(categories), [categories]);
  const financialCategories = useMemo(() => resolveFinancialAttendanceCategories(categories), [categories]);
  const selectableCategories = useMemo(
    () => [...orderedCategories, ...financialCategories],
    [financialCategories, orderedCategories]
  );
  const selectedCategory = useMemo(
    () => selectableCategories.find((category) => category.id === selectedCategoryId),
    [selectableCategories, selectedCategoryId]
  );
  const latestTicket = createdTicket || getLatestTicket(tickets, selectedContract?.id);
  const currentStep = getAttendanceStep({ chatTicket, diagnosis, selectedCategoryId });

  useEffect(() => {
    let active = true;
    setConnectionChecked(false);

    void Promise.resolve(onRefresh()).finally(() => {
      if (active) {
        setConnectionChecked(true);
      }
    });

    return () => {
      active = false;
    };
  }, [onRefresh, selectedContract?.id]);

  async function runDiagnosis(categoryId, nextAnswers = {}) {
    if (!selectedContract?.id) {
      return;
    }

    setLoading(true);
    setError("");
    setSelectedCategoryId(categoryId);

    try {
      const result = await clienteRequest("/v1/support/diagnosis", {
        method: "POST",
        body: {
          contractId: selectedContract.id,
          categoryId,
          answers: nextAnswers
        }
      });
      setDiagnosis(result);
      setAnswers(nextAnswers);
      setTextAnswer("");
    } catch (caughtError) {
      const financialFallback = createFinancialFallbackDiagnosis(categoryId);

      if (financialFallback) {
        setDiagnosis(financialFallback);
        setAnswers(nextAnswers);
        setTextAnswer("");
        return;
      }

      setError(resolveErrorMessage(caughtError, "Não foi possível iniciar a triagem."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectCategory(categoryId) {
    setDiagnosis(null);
    setAnswers({});
    setAnswerTrail([]);
    setTextAnswer("");
    await runDiagnosis(categoryId);
  }

  async function handleOfflineDetails(optionId, description) {
    const option = offlineDiagnosticOptions.find((item) => item.id === optionId);
    if (!option) {
      return;
    }

    const normalizedDescription = description.trim();
    setAnswerTrail([
      { id: "offline_status", label: "Status detectado", value: "OFFLINE" },
      { id: "offline_initial_option", label: "Diagnóstico inicial", value: option.label },
      { id: "offline_customer_description", label: "Descrição do cliente", value: normalizedDescription }
    ]);
    await runDiagnosis("no_internet", {
      offline_initial_option: option.id,
      offline_customer_description: normalizedDescription
    });
  }

  async function handleQuestionAnswer(value) {
    const question = diagnosis?.question;
    const questionId = question?.id;
    if (!questionId || !selectedCategoryId) {
      return;
    }

    const nextAnswers = { ...answers, [questionId]: value };
    const selectedOption = question.options?.find((option) => option.value === value);
    setAnswerTrail((current) => [
      ...current.filter((item) => item.id !== questionId),
      {
        id: questionId,
        label: question.text || "Detalhe informado",
        value: selectedOption?.label || value
      }
    ]);
    await runDiagnosis(selectedCategoryId, nextAnswers);
  }

  function resetAttendanceFlow() {
    setSelectedCategoryId("");
    setDiagnosis(null);
    setAnswers({});
    setAnswerTrail([]);
    setTextAnswer("");
    setError("");
  }

  async function handleCreateTicket() {
    if (!diagnosis?.diagnosisId || !selectedContract?.id) {
      return;
    }

    if (!isValidBrazilianPhone(contactPhone)) {
      setError("Informe um telefone brasileiro válido para contato.");
      return;
    }

    setCreatingTicket(true);
    setError("");

    try {
      const ticket = await clienteRequest("/v1/support/tickets", {
        method: "POST",
        body: {
          contractId: selectedContract.id,
          diagnosisId: diagnosis.diagnosisId,
          contactPhone
        }
      });
      setCreatedTicket(normalizeTicketVisit(ticket, selectedContract.id));
      await onRefresh();
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível abrir o chamado."));
      await onRefresh();
    } finally {
      setCreatingTicket(false);
    }
  }

  if (chatTicket) {
    return (
      <div className="cliente-attendance-page">
        <AttendanceStepper currentStep={3} />
        <div className="cliente-attendance-layout">
          <div className="cliente-attendance-main">
            <section className="cliente-attendance-flow-card">
              <div className="cliente-attendance-card-head">
                <span>ATENDIMENTO EM ANDAMENTO</span>
                <h3>{createdTicket ? "Atendimento aberto" : "Você já possui um atendimento em andamento."}</h3>
                <p>{createdTicket ? "Nossa equipe recebeu sua solicitação. O chat será aberto quando um atendente iniciar a conversa." : "Continue o acompanhamento com a equipe AcessaNet."}</p>
              </div>
              <InlineNotice
                tone={createdTicket ? "success" : "warning"}
                title={createdTicket ? `Protocolo #${chatTicket.protocol || chatTicket.id}` : `Chamado #${chatTicket.protocol || chatTicket.id}`}
                message={createdTicket ? "Chamado criado com sucesso." : "Para evitar duplicidade, use o chamado já aberto."}
              />
            </section>
            <TicketPanel ticket={chatTicket} />
            {/* Chat desativado temporariamente na abertura/acompanhamento de chamado (pedido do NOC, 2026-09-28) */}
          </div>
          <AttendanceSidebar
            latestTicket={latestTicket}
            loading={dataLoading}
            onRefresh={onRefresh}
            selectedCategoryId={selectedCategoryId || chatTicket.categoryId}
          />
        </div>
      </div>
    );
  }

  if (!connectionChecked) {
    return (
      <div className="cliente-attendance-page">
        <AttendanceStepper currentStep={1} />
        <div className="cliente-attendance-layout">
          <section className="cliente-attendance-flow-card">
            <div className="cliente-attendance-card-head">
              <span>VERIFICANDO CONEXÃO</span>
              <h3>Preparando seu atendimento</h3>
              <p>Consultando o status atual da sua conexão.</p>
            </div>
            <LoadingInline label="Verificando conexão" />
          </section>
          <AttendanceSidebar
            latestTicket={latestTicket}
            loading={dataLoading}
            onRefresh={onRefresh}
            selectedCategoryId={selectedCategoryId}
          />
        </div>
      </div>
    );
  }

  if (isOfflineConnection(connection, selectedContract) && !diagnosis) {
    return (
      <div className="cliente-attendance-page">
        <AttendanceStepper currentStep={1} />
        <div className="cliente-attendance-layout">
          <section className="cliente-attendance-flow-card">
            <div className="cliente-attendance-card-head">
              <span>DIAGNÓSTICO AUTOMÁTICO</span>
              <h3>Cliente sem conexão</h3>
              <p>Detectamos que você está sem internet. Consegue me descrever o que está acontecendo?</p>
            </div>
            {error ? <InlineNotice tone="danger" title="Atendimento" message={error} /> : null}
            <OfflineAttendanceStep loading={loading} onSubmit={handleOfflineDetails} />
          </section>
          <AttendanceSidebar
            latestTicket={latestTicket}
            loading={dataLoading}
            onRefresh={onRefresh}
            selectedCategoryId="no_internet"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="cliente-attendance-page">
      <AttendanceStepper currentStep={currentStep} />
      <div className="cliente-attendance-layout">
        <section className="cliente-attendance-flow-card">
          <div className="cliente-attendance-card-head">
            <span>PASSO {currentStep} DE 3</span>
            <h3>{attendanceStepTitle(currentStep, diagnosis)}</h3>
            <p>{attendanceStepDescription(currentStep, diagnosis)}</p>
          </div>

          {error ? <InlineNotice tone="danger" title="Atendimento" message={error} /> : null}

          {currentStep === 1 ? (
            <IssueSelectionStep
              categories={orderedCategories}
              financialCategories={financialCategories}
              loading={dataLoading}
              onSelect={(categoryId) => void handleSelectCategory(categoryId)}
              selectedCategoryId={selectedCategoryId}
              selectedContract={selectedContract}
            />
          ) : null}

          {currentStep === 2 ? (
            <AttendanceDetailsStep
              diagnosis={diagnosis}
              loading={loading}
              onAnswer={(value) => void handleQuestionAnswer(value)}
              onBack={resetAttendanceFlow}
              selectedCategory={selectedCategory}
              textAnswer={textAnswer}
              onTextAnswerChange={setTextAnswer}
            />
          ) : null}

          {currentStep === 3 ? (
            <AttendanceReviewStep
              answerTrail={answerTrail}
              creatingTicket={creatingTicket}
              diagnosis={diagnosis}
              onBack={resetAttendanceFlow}
              contactPhone={contactPhone}
              onContactPhoneChange={(value) => setContactPhone(formatBrazilianPhone(value))}
              onCreateTicket={handleCreateTicket}
              selectedCategory={selectedCategory}
              selectedContract={selectedContract}
            />
          ) : null}
        </section>

        <AttendanceSidebar
          latestTicket={latestTicket}
          loading={dataLoading}
          onRefresh={onRefresh}
          selectedCategoryId={selectedCategoryId}
        />
      </div>
    </div>
  );
}

function OfflineAttendanceStep({ loading, onSubmit }) {
  const [optionId, setOptionId] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="cliente-attendance-step-panel">
      <div className="cliente-attendance-question">
        <label>O que você observa no modem ou ONU?</label>
        <div className="cliente-answer-options">
          {offlineDiagnosticOptions.map((option) => (
            <button
              aria-pressed={option.id === optionId}
              className={`cliente-answer-card ${option.id === optionId ? "is-selected" : ""}`}
              key={option.id}
              type="button"
              disabled={loading}
              onClick={() => setOptionId(option.id)}
            >
              <span>{option.label}</span>
              {option.id === optionId ? <Check size={17} /> : <ChevronRight size={17} />}
            </button>
          ))}
        </div>
      </div>

      {optionId ? (
        <div className="cliente-attendance-question">
          <label htmlFor="cliente-offline-description">Conte mais detalhes do que está acontecendo</label>
          <textarea
            className="cliente-offline-description"
            id="cliente-offline-description"
            rows={5}
            maxLength={500}
            placeholder="Descreva o que aconteceu antes de ficar sem internet..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="cliente-attendance-actions">
            <button
              className="cliente-primary-action"
              type="button"
              disabled={!description.trim() || loading}
              onClick={() => onSubmit(optionId, description)}
            >
              {loading ? <Loader2 size={18} className="cliente-spin" /> : <ChevronRight size={18} />}
              Continuar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AttendanceStepper({ currentStep }) {
  const steps = [
    ["Escolha o problema", "O que está acontecendo?"],
    ["Detalhes", "Nos conte mais sobre o caso"],
    ["Abrir atendimento", "Revise e envie"]
  ];

  return (
    <nav className="cliente-attendance-stepper" aria-label="Etapas do atendimento">
      {steps.map(([title, description], index) => {
        const step = index + 1;
        const isActive = step === currentStep;
        const isDone = step < currentStep;

        return (
          <div
            className={`cliente-attendance-step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
            key={title}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="cliente-attendance-step-number">
              {isDone ? <Check size={15} /> : step}
            </span>
            <div>
              <strong>{title}</strong>
              <small>{description}</small>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function IssueSelectionStep({ categories, financialCategories, loading, onSelect, selectedCategoryId, selectedContract }) {
  if (loading && !categories.length) {
    return (
      <div className="cliente-issue-grid" aria-label="Carregando opções de atendimento">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="cliente-issue-card is-skeleton" key={index} />
        ))}
      </div>
    );
  }

  if (!categories.length) {
    return (
      <InlineNotice
        tone="warning"
        title="Categorias indisponíveis"
        message="Não foi possível carregar as opções de atendimento agora. Tente atualizar a página."
      />
    );
  }

  return (
    <div className="cliente-issue-stack">
      <div className="cliente-issue-grid">
        {categories.map((category) => (
          <IssueCard
            category={category}
            key={category.id}
            onSelect={onSelect}
            selected={category.id === selectedCategoryId}
          />
        ))}
      </div>

      <section className="cliente-issue-section" aria-labelledby="cliente-financeiro-title">
        <div className="cliente-issue-section-head">
          <h4 id="cliente-financeiro-title">Financeiro</h4>
          <p>Assuntos relacionados a boleto e cobranças.</p>
        </div>
        <div className="cliente-issue-grid">
          {financialCategories.map((category) => (
            <IssueCard
              category={category}
              key={category.id}
              onSelect={onSelect}
              selected={category.id === selectedCategoryId}
              whatsappHref={getFinancialAttendanceWhatsappUrl(category.id, selectedContract)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function IssueCard({ category, onSelect, selected, whatsappHref }) {
  const meta = issueMeta(category);
  const Icon = meta.icon;
  const content = (
    <>
      <span className="cliente-issue-icon">
        <Icon size={20} />
      </span>
      <span className="cliente-issue-copy">
        <strong>{category.title}</strong>
        <small>{category.description}</small>
      </span>
      {whatsappHref ? (
        <MessageCircle size={18} className="cliente-issue-chevron" />
      ) : selected ? (
        <CheckCircle2 size={18} className="cliente-issue-check" />
      ) : (
        <ChevronRight size={18} className="cliente-issue-chevron" />
      )}
    </>
  );

  if (whatsappHref) {
    return (
      <a
        className={`cliente-issue-card tone-${meta.tone}`}
        href={whatsappHref}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={`cliente-issue-card tone-${meta.tone} ${selected ? "is-selected" : ""}`}
      type="button"
      onClick={() => onSelect(category.id)}
      aria-pressed={selected}
    >
      {content}
    </button>
  );
}

/** Mesma regra do backend (src/diagnosis/engine.ts validateRouterPassword) -- nunca deixar divergir, o backend continua sendo a fonte de verdade. */
function validateRouterPasswordClientSide(value) {
  if (!value) return "";
  if (value.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (value.length > 63) return "A senha pode ter no máximo 63 caracteres.";
  if (!/[A-Z]/.test(value)) return "A senha precisa ter pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(value)) return "A senha precisa ter pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(value)) return "A senha precisa ter pelo menos um caractere especial.";
  return "";
}

const routerPasswordRules = [
  { id: "length", label: "Pelo menos 8 caracteres", test: (value) => value.length >= 8 },
  { id: "uppercase", label: "Uma letra maiúscula", test: (value) => /[A-Z]/.test(value) },
  { id: "number", label: "Um número", test: (value) => /[0-9]/.test(value) },
  { id: "special", label: "Um caractere especial", test: (value) => /[^A-Za-z0-9]/.test(value) }
];

/** Mostra os 4 criterios de uma vez (nao um erro por vez): evita o cliente achar que cada regra exige caracteres A MAIS depois dos 8. */
function RouterPasswordRequirements({ value }) {
  return (
    <ul className="cliente-password-requirements">
      {routerPasswordRules.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.id} className={met ? "is-met" : "is-pending"}>
            {met ? <Check size={14} /> : <X size={14} />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

function AttendanceDetailsStep({ diagnosis, loading, onAnswer, onBack, onTextAnswerChange, selectedCategory, textAnswer }) {
  const question = diagnosis?.question;
  const isRouterPassword = question?.id === "router_password_new";
  const routerPasswordError = isRouterPassword ? validateRouterPasswordClientSide(textAnswer) : "";

  return (
    <div className="cliente-attendance-step-panel">
      <SelectedIssueSummary category={selectedCategory} />
      {loading && !question ? <LoadingInline label="Preparando perguntas da triagem" /> : null}
      {diagnosis?.customerMessage ? (
        <InlineNotice tone="info" title="Triagem AcessaNet" message={diagnosis.customerMessage} />
      ) : null}

      {question ? (
        <div className="cliente-attendance-question">
          <label>{question.text || "Conte mais detalhes"}</label>
          {question.helperText ? <p>{question.helperText}</p> : null}

          {question.inputType === "text" || question.inputType === "password" ? (
            <div className="cliente-attendance-text-form">
              {question.inputType === "password" ? (
                <input
                  type="password"
                  value={textAnswer}
                  onChange={(event) => onTextAnswerChange(event.target.value)}
                />
              ) : (
                <textarea
                  rows={5}
                  placeholder="Conte um pouco mais sobre o que está acontecendo..."
                  value={textAnswer}
                  onChange={(event) => onTextAnswerChange(event.target.value)}
                />
              )}
              {isRouterPassword ? <RouterPasswordRequirements value={textAnswer} /> : null}
              <div className="cliente-attendance-actions">
                <button className="cliente-soft-action" type="button" onClick={onBack}>
                  <ArrowLeft size={17} />
                  Voltar
                </button>
                <button
                  className="cliente-primary-action"
                  type="button"
                  disabled={!textAnswer.trim() || loading || (isRouterPassword && Boolean(routerPasswordError))}
                  onClick={() => onAnswer(textAnswer.trim())}
                >
                  {loading ? <Loader2 size={18} className="cliente-spin" /> : <ChevronRight size={18} />}
                  Continuar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="cliente-answer-options">
                {question.options?.map((option) => (
                  <button
                    className="cliente-answer-card"
                    key={option.id}
                    type="button"
                    disabled={loading}
                    onClick={() => onAnswer(option.value)}
                  >
                    <span>{option.label}</span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
              <div className="cliente-attendance-actions">
                <button className="cliente-soft-action" type="button" onClick={onBack}>
                  <ArrowLeft size={17} />
                  Voltar
                </button>
                {loading ? <LoadingInline label="Atualizando triagem" /> : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AttendanceReviewStep({
  answerTrail,
  contactPhone,
  creatingTicket,
  diagnosis,
  onBack,
  onContactPhoneChange,
  onCreateTicket,
  selectedCategory,
  selectedContract
}) {
  const address = selectedContract ? `${selectedContract.addressLine}, ${selectedContract.city} - ${selectedContract.state}` : undefined;
  const description = answerTrail.length
    ? answerTrail.map((item) => `${item.label}: ${item.value}`).join(" | ")
    : diagnosis?.customerMessage || "Triagem concluída.";

  if (diagnosis?.state === "BLOCKED" || !diagnosis?.canOpenTicket) {
    return (
      <div className="cliente-attendance-step-panel">
        <SelectedIssueSummary category={selectedCategory} />
        <InlineNotice
          tone="warning"
          title="Chamado não aberto"
          message={diagnosis?.customerMessage || "A triagem não permitiu abrir um chamado agora."}
        />
        <div className="cliente-attendance-actions">
          <button className="cliente-soft-action" type="button" onClick={onBack}>
            <ArrowLeft size={17} />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cliente-attendance-step-panel">
      <SelectedIssueSummary category={selectedCategory} />
      {diagnosis?.customerMessage ? (
        <InlineNotice tone="success" title="Triagem concluída" message={diagnosis.customerMessage} />
      ) : null}

      <div className="cliente-review-list">
        <ReviewItem label="Problema" value={selectedCategory?.title} />
        <ReviewItem label="Contrato" value={selectedContract?.id} />
        <ReviewItem label="Endereço" value={address} />
        <ReviewItem label="Descrição" value={description} />
      </div>

      <div className="cliente-attendance-text-form cliente-contact-phone-field">
        <label htmlFor="cliente-contact-phone">Telefone/Celular para contato</label>
        <input
          aria-invalid={contactPhone ? !isValidBrazilianPhone(contactPhone) : undefined}
          autoComplete="tel"
          id="cliente-contact-phone"
          inputMode="tel"
          maxLength={16}
          placeholder="(11) 99999-9999"
          type="tel"
          value={contactPhone}
          onChange={(event) => onContactPhoneChange(event.target.value)}
        />
        {contactPhone && !isValidBrazilianPhone(contactPhone) ? (
          <small>Informe DDD e telefone ou celular.</small>
        ) : null}
      </div>

      <div className="cliente-attendance-actions">
        <button className="cliente-soft-action" type="button" onClick={onBack} disabled={creatingTicket}>
          <ArrowLeft size={17} />
          Voltar
        </button>
        <button
          className="cliente-primary-action"
          type="button"
          onClick={onCreateTicket}
          disabled={creatingTicket || !isValidBrazilianPhone(contactPhone)}
        >
          {creatingTicket ? <Loader2 size={18} className="cliente-spin" /> : <MessageCircle size={18} />}
          {creatingTicket ? "Abrindo atendimento..." : "Abrir atendimento"}
        </button>
      </div>
    </div>
  );
}

function SelectedIssueSummary({ category }) {
  if (!category) return null;
  const meta = issueMeta(category);
  const Icon = meta.icon;

  return (
    <div className={`cliente-selected-issue tone-${meta.tone}`}>
      <span className="cliente-issue-icon">
        <Icon size={19} />
      </span>
      <div>
        <small>Problema selecionado</small>
        <strong>{category.title}</strong>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }) {
  return (
    <div className="cliente-review-item">
      <span>{label}</span>
      <strong>{value || "Não informado"}</strong>
    </div>
  );
}

function AttendanceSidebar({ latestTicket, loading, onRefresh, selectedCategoryId }) {
  return (
    <aside className="cliente-attendance-sidebar" aria-label="Ajuda e histórico">
      <LatestTicketCard latestTicket={latestTicket} loading={loading} onRefresh={onRefresh} />
      <QuickTipCard selectedCategoryId={selectedCategoryId} />
    </aside>
  );
}

function LatestTicketCard({ latestTicket, loading, onRefresh }) {
  const ticket = normalizeTicketVisit(latestTicket);
  const tone = ticketStatusTone(ticket?.status, ticket?.statusInterno);

  return (
    <section className="cliente-attendance-side-card">
      <div className="cliente-side-card-head">
        <h3>Último chamado</h3>
        <Link to="/cliente/chamados">Ver todos <ArrowRight size={15} /></Link>
      </div>

      {loading && !ticket ? (
        <div className="cliente-side-skeleton" aria-label="Carregando último chamado" />
      ) : ticket ? (
        <div className="cliente-latest-ticket">
          <div className="cliente-latest-ticket-meta">
            <span className={`cliente-ticket-badge tone-${tone}`}>{ticketStatusLabel(ticket.status, ticket.statusInterno)}</span>
            <small>{formatDateTime(ticket.createdAt || ticket.updatedAt) || "Data não informada"}</small>
          </div>
          <strong>#{ticket.protocol || ticket.id}</strong>
          <h4>{ticket.title || "Atendimento"}</h4>
          <AppointmentNotice appointment={ticket.appointment} compact />
          <p>{latestTicketDescription(ticket)}</p>
        </div>
      ) : (
        <div className="cliente-empty-ticket">
          <p>Nenhum atendimento anterior.</p>
          <button className="cliente-soft-action" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      )}
    </section>
  );
}

function QuickTipCard({ selectedCategoryId }) {
  const meta = issueMeta({ id: selectedCategoryId });

  return (
    <section className="cliente-attendance-side-card">
      <div className="cliente-tip-head">
        <span>
          <Lightbulb size={18} />
        </span>
        <h3>Dica rápida</h3>
      </div>
      <p>{meta.tip || "Escolha o problema para ver uma dica rápida antes de abrir o atendimento."}</p>
    </section>
  );
}

function CustomerChat({ contractId, onClosed, ticket }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatToken, setChatToken] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [waitingForAgent, setWaitingForAgent] = useState(false);
  const [notice, setNotice] = useState("");

  const loadMessages = useCallback(async (token, conversationId) => {
    const payload = await chatRequest(`/api/customer/chat/conversations/${conversationId}/messages`, token);
    setMessages((current) => mergeChatMessages(current, extractMessageArray(payload).map((item) => normalizeChatMessage(item, conversationId))));
    if (payload?.conversation?.status === "closed") {
      setConversation(normalizeConversation(payload.conversation, ticket));
      setNotice("Este atendimento foi encerrado.");
      onClosed?.();
    }
  }, [onClosed, ticket]);

  const loadConversation = useCallback(async (silent = false) => {
    if (!contractId || !ticket?.id) {
      return;
    }

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const token = await getChatToken(contractId, ticket.id);
      setChatToken(token);
      const payload = await chatRequest("/api/customer/chat/conversations/active", token);
      const nextConversation = normalizeConversation(payload?.conversation || payload, ticket);

      setConversation(nextConversation);
      setWaitingForAgent(false);
      setError("");
      if (silent) {
        setNotice("Um atendente iniciou uma conversa com você.");
      }
      await loadMessages(token, nextConversation.id);
    } catch (caughtError) {
      if (caughtError instanceof ClienteApiError && caughtError.status === 404) {
        setConversation(null);
        setMessages([]);
        setWaitingForAgent(true);
        setError("");
      } else {
        setError(resolveErrorMessage(caughtError, "Não foi possível abrir a conversa."));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [contractId, loadMessages, ticket]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!chatToken || conversation?.id) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadConversation(true);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [chatToken, conversation?.id, loadConversation]);

  useEffect(() => {
    if (!chatToken || !conversation?.id) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadMessages(chatToken, conversation.id).catch(() => undefined);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [chatToken, conversation?.id, loadMessages]);

  async function handleSend(event) {
    event.preventDefault();
    const body = input.trim();
    if (!body || !chatToken || !conversation?.id || sending) {
      return;
    }

    const clientMessageId = createClientMessageId();
    setInput("");
    setSending(true);
    setMessages((current) =>
      mergeChatMessages(current, [
        {
          id: clientMessageId,
          clientMessageId,
          conversationId: conversation.id,
          role: "customer",
          authorName: "Você",
          body,
          createdAt: new Date().toISOString(),
          pending: true
        }
      ])
    );

    try {
      const payload = await chatRequest(`/api/customer/chat/conversations/${conversation.id}/messages`, chatToken, {
        method: "POST",
        body: {
          message: body,
          clientMessageId
        }
      });
      setMessages((current) => mergeChatMessages(current, [normalizeChatMessage(payload?.message || payload, conversation.id)]));
      await loadMessages(chatToken, conversation.id);
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível enviar a mensagem."));
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === clientMessageId ? { ...message, failed: true, pending: false } : message
        )
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <section className="cliente-panel cliente-chat-panel">
        <LoadingInline label="Abrindo atendimento" />
      </section>
    );
  }

  if (waitingForAgent && !conversation) {
    return (
      <section className="cliente-panel cliente-chat-panel">
        <div className="cliente-chat-head">
          <div>
            <span>Chat AcessaNet</span>
            <h3>{ticket.title || `Chamado #${ticket.protocol || ticket.id}`}</h3>
          </div>
        </div>
        <InlineNotice
          title="Aguardando atendimento"
          message="Seu chamado foi aberto. O chat aparecerá aqui quando um atendente iniciar a conversa."
        />
      </section>
    );
  }

  if (conversation?.status === "closed") {
    return (
      <section className="cliente-panel cliente-chat-panel">
        <InlineNotice
          tone="success"
          title="Atendimento encerrado"
          message="A conversa foi concluída pela equipe AcessaNet."
        />
      </section>
    );
  }

  return (
    <section className="cliente-panel cliente-chat-panel">
      <div className="cliente-chat-head">
        <div>
          <span>Chat AcessaNet</span>
          <h3>{conversation?.ticketTitle || ticket.title || `Chamado #${ticket.protocol || ticket.id}`}</h3>
        </div>
        <span className="cliente-live-chip">Atualização automática</span>
      </div>

      {error ? <InlineNotice tone="danger" title="Chat" message={error} /> : null}
      {notice ? <InlineNotice tone="success" title="Chat iniciado" message={notice} /> : null}

      <div className="cliente-chat-messages">
        {!messages.length ? <p className="cliente-muted">Nenhuma mensagem ainda.</p> : null}
        {messages.map((message) => (
          <article
            className={`cliente-message cliente-message-${message.role} ${message.pending ? "is-pending" : ""} ${message.failed ? "is-failed" : ""}`}
            key={message.clientMessageId || message.id}
          >
            <span>{message.role === "customer" ? "Você" : message.authorName || "AcessaNet"}</span>
            <p>{message.body}</p>
            <small>{message.failed ? "Falha no envio" : message.pending ? "Enviando..." : formatTime(message.createdAt)}</small>
          </article>
        ))}
      </div>

      <form className="cliente-chat-composer" onSubmit={handleSend}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Digite sua mensagem"
          disabled={sending}
        />
        <button type="submit" disabled={!input.trim() || sending}>
          {sending ? <Loader2 size={18} className="cliente-spin" /> : <Send size={18} />}
        </button>
      </form>
    </section>
  );
}

function ChamadosPage({ currentTicket, loading, tickets }) {
  const activeTicket = getActiveTicket(currentTicket, tickets);
  const allTickets = dedupeTickets([activeTicket, ...(tickets || [])].filter(Boolean));

  return (
    <div className="cliente-page-stack">
      {loading ? <LoadingInline label="Carregando chamados" /> : null}
      {!allTickets.length ? (
        <InlineNotice tone="success" title="Nenhum chamado encontrado" message="Aqui aparecem todos os seus chamados, abertos e encerrados." />
      ) : null}
      {allTickets.map((ticket) => (
        <TicketPanel key={ticket.id} ticket={ticket} actionTo="/cliente/atendimento" actionLabel="Abrir atendimento" />
      ))}
    </div>
  );
}

function PerfilPage({ contracts, customer, onLogout, onSelectContract, selectedContractId }) {
  return (
    <div className="cliente-page-grid">
      <section className="cliente-panel">
        <h3>Dados cadastrais</h3>
        <InfoList
          items={[
            ["Nome", customer?.name],
            ["CPF", customer?.maskedCpf],
            ["Telefone", customer?.maskedPhone]
          ]}
        />
      </section>

      <section className="cliente-panel">
        <h3>Contratos</h3>
        <div className="cliente-contract-list">
          {contracts.map((contract) => (
            <button
              className={`cliente-contract-card ${contract.id === selectedContractId ? "is-selected" : ""}`}
              key={contract.id}
              type="button"
              onClick={() => onSelectContract(contract.id)}
            >
              <strong>{contract.planName}</strong>
              <span>{contract.addressLine}</span>
              <small>
                <span className={`cliente-contract-dot tone-${contractStatusTone(contract.status)}`} aria-hidden="true" />
                {contractStatusLabel(contract.status)}
              </small>
            </button>
          ))}
        </div>
        <button className="cliente-danger-action" type="button" onClick={onLogout}>
          <LogOut size={17} />
          Encerrar sessão
        </button>
      </section>

      <SecurityPasswordSection />
    </div>
  );
}

function SecurityPasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Nova senha e confirmação não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (caughtError) {
      setError(resolveErrorMessage(caughtError, "Não foi possível alterar a senha agora."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="cliente-panel">
      <h3>Segurança</h3>
      <form className="cliente-attendance-text-form" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="perfil-current-password">Senha atual</label>
          <ClientePasswordField
            autoComplete="current-password"
            id="perfil-current-password"
            value={currentPassword}
            onChange={(event) => {
              setError("");
              setSuccess(false);
              setCurrentPassword(event.target.value);
            }}
          />
        </div>

        <div>
          <label htmlFor="perfil-new-password">Nova senha</label>
          <ClientePasswordField
            autoComplete="new-password"
            id="perfil-new-password"
            value={newPassword}
            onChange={(event) => {
              setError("");
              setSuccess(false);
              setNewPassword(event.target.value);
            }}
          />
          <small>Pelo menos 8 caracteres, com letras e números.</small>
        </div>

        <div>
          <label htmlFor="perfil-confirm-password">Confirmar nova senha</label>
          <ClientePasswordField
            autoComplete="new-password"
            id="perfil-confirm-password"
            value={confirmPassword}
            onChange={(event) => {
              setError("");
              setSuccess(false);
              setConfirmPassword(event.target.value);
            }}
          />
        </div>

        {error ? <p className="cliente-form-error">{error}</p> : null}
        {success ? <p className="cliente-form-success">Senha alterada com sucesso.</p> : null}

        <button className="cliente-primary-action" type="submit" disabled={loading}>
          {loading ? <Loader2 size={18} className="cliente-spin" /> : <KeyRound size={18} />}
          {loading ? "Alterando..." : "Alterar senha"}
        </button>
      </form>
    </section>
  );
}

/** Campo de senha com botao mostrar/ocultar para telas ja autenticadas (dentro do shell do app). Equivalente a LoginPasswordField, mas com as classes cliente-* (fora da tela de login). */
function ClientePasswordField({ autoComplete, id, onChange, value }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="cliente-password-field">
      <input
        autoComplete={autoComplete}
        id={id}
        placeholder="••••••••"
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
      />
      <button
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className="cliente-password-toggle"
        type="button"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function TicketPanel({ actionLabel, actionTo, ticket }) {
  const isClosed = ticket.statusInterno === "closed";

  return (
    <section className="cliente-panel cliente-ticket-panel">
      <div className="cliente-panel-head">
        <Ticket size={22} />
        <div>
          <span>Chamado #{ticket.protocol || ticket.id}</span>
          <h3>{ticket.title || "Atendimento"}</h3>
        </div>
      </div>
      <AppointmentNotice appointment={ticket.appointment} />
      <InfoList
        items={[
          ["Status", ticketStatusLabel(ticket.status, ticket.statusInterno)],
          ["Contrato", ticket.contractId],
          ["Aberto em", formatDateTime(ticket.createdAt || ticket.openedAt)],
          ["Atualizado em", formatDateTime(ticket.updatedAt)],
          ...(isClosed && ticket.closureReason ? [["Motivo do encerramento", ticket.closureReason]] : [])
        ]}
      />
      {actionTo && !isClosed ? (
        <Link className="cliente-soft-action cliente-soft-action-link" to={actionTo}>
          {actionLabel || "Ver atendimento"}
          <ArrowRight size={17} />
        </Link>
      ) : null}
    </section>
  );
}

function AppointmentNotice({ appointment, compact = false }) {
  const schedule = formatAppointmentSchedule(appointment);

  if (!schedule) {
    return null;
  }

  return (
    <div className={`cliente-appointment-notice ${compact ? "is-compact" : ""}`}>
      <span className="cliente-appointment-icon">
        <CalendarClock size={compact ? 17 : 19} />
      </span>
      <div>
        <small>Visita técnica agendada</small>
        <strong>{schedule}</strong>
      </div>
    </div>
  );
}

function InfoList({ items }) {
  return (
    <dl className="cliente-info-list">
      {items
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}

function InlineNotice({ message, title, tone = "info" }) {
  const Icon = tone === "danger" ? AlertCircle : tone === "success" ? CheckCircle2 : CalendarClock;
  return (
    <section className={`cliente-notice tone-${tone}`}>
      <Icon size={20} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </section>
  );
}

function LoadingInline({ label }) {
  return (
    <div className="cliente-loading-inline">
      <Loader2 size={20} className="cliente-spin" />
      <span>{label}</span>
    </div>
  );
}

function ClienteLoadingScreen() {
  return (
    <main className="login login-loading">
      <img src={logoLight} alt="AcessaNet" className="login-loading-logo" />
      <LoadingInline label="Carregando Área do Cliente" />
    </main>
  );
}

const pageTitles = {
  inicio: { eyebrow: "Resumo", title: "Início" },
  internet: { eyebrow: "Minha conexão", title: "Internet" },
  faturas: { eyebrow: "Financeiro", title: "Faturas" },
  plano: { eyebrow: "Assinatura", title: "Meu plano" },
  atendimento: {
    eyebrow: "Suporte",
    title: "Atendimento",
    description: "Estamos aqui para ajudar. Abra seu atendimento de forma rápida e descomplicada."
  },
  chamados: { eyebrow: "Histórico", title: "Chamados" },
  assinaturas: { eyebrow: "Contratos", title: "Assinaturas" },
  perfil: { eyebrow: "Conta", title: "Perfil" }
};

function orderAttendanceCategories(categories = []) {
  const knownOrder = new Map(attendanceCategoryOrder.map((id, index) => [id, index]));

  return categories.filter((category) => !isFinancialAttendanceCategory(category.id)).sort((left, right) => {
    const leftOrder = knownOrder.has(left.id) ? knownOrder.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightOrder = knownOrder.has(right.id) ? knownOrder.get(right.id) : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.title || "").localeCompare(String(right.title || ""), "pt-BR");
  });
}

function resolveFinancialAttendanceCategories(categories = []) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return financialAttendanceCategories.map((fallbackCategory) => ({
    ...categoriesById.get(fallbackCategory.id),
    ...fallbackCategory
  }));
}

function isFinancialAttendanceCategory(categoryId) {
  return financialAttendanceCategoryIds.has(categoryId);
}

function createFinancialFallbackDiagnosis(categoryId) {
  const category = financialAttendanceCategories.find((item) => item.id === categoryId);

  if (!category) {
    return null;
  }

  return {
    state: "BLOCKED",
    canOpenTicket: false,
    customerMessage: `${category.title} selecionado. Esse assunto financeiro será direcionado pelo atendimento AcessaNet.`
  };
}

const financialAttendanceWhatsappMessages = {
  billing_second_copy: "Olá! Preciso da 2ª via de um boleto.",
  billing_dispute: "Olá! Gostaria de contestar uma cobrança."
};

/** Mesmo numero usado no restante do site (rodape, chatbot, planos). */
function getFinancialAttendanceWhatsappUrl(categoryId, contract) {
  const baseMessage = financialAttendanceWhatsappMessages[categoryId];
  if (!baseMessage) {
    return undefined;
  }

  const message = contract?.id ? `${baseMessage} Contrato: ${contract.id}` : baseMessage;
  return `https://wa.me/5508004445799?text=${encodeURIComponent(message)}`;
}

/** Mesmo numero usado no restante do site (rodape, chatbot, planos). */
function getPlanUpgradeWhatsappUrl(contract) {
  const planLabel = contract?.planName ? ` do plano ${contract.planName}` : "";
  const contractLabel = contract?.id ? ` Contrato: ${contract.id}.` : "";
  const message = `Olá! Sou assinante${planLabel} e quero fazer upgrade para o plano 800 Mega.${contractLabel}`;
  return `https://wa.me/5508004445799?text=${encodeURIComponent(message)}`;
}

function issueMeta(category) {
  return attendanceIssueVisuals[category?.id] || {
    icon: LifeBuoy,
    tone: "slate",
    tip: "Escolha o problema para ver uma dica rápida antes de abrir o atendimento."
  };
}

function getAttendanceStep({ chatTicket, diagnosis, selectedCategoryId }) {
  if (chatTicket) return 3;
  if (!selectedCategoryId) return 1;
  if (diagnosis?.state === "SUMMARY" || diagnosis?.state === "BLOCKED") return 3;
  return 2;
}

function attendanceStepTitle(step, diagnosis) {
  if (step === 1) return "Escolha o problema";
  if (step === 2) return "Conte mais detalhes";
  if (diagnosis?.state === "BLOCKED") return "Não foi possível abrir agora";
  return "Revise seu atendimento";
}

function attendanceStepDescription(step, diagnosis) {
  if (step === 1) {
    return "Selecione abaixo o que melhor descreve o seu problema para que possamos te ajudar mais rápido.";
  }

  if (step === 2) {
    return "Responda as perguntas da triagem para direcionarmos o atendimento corretamente.";
  }

  if (diagnosis?.state === "BLOCKED") {
    return "A triagem encontrou uma orientação antes de abrir um novo atendimento.";
  }

  return "Confira as informações e confirme para abrir o atendimento com a equipe AcessaNet.";
}

function getLatestTicket(tickets = [], contractId) {
  return [...tickets]
    .filter((ticket) => !contractId || ticket.contractId === contractId)
    .sort((left, right) => {
      const leftDate = new Date(left.updatedAt || left.createdAt || left.openedAt || 0).getTime();
      const rightDate = new Date(right.updatedAt || right.createdAt || right.openedAt || 0).getTime();
      return rightDate - leftDate;
    })[0];
}

function ticketStatusTone(status, internalStatus) {
  if (internalStatus === "closed" || status === "RESOLVED") return "green";
  if (status === "CANCELED") return "red";
  if (status === "WAITING_CUSTOMER" || status === "SCHEDULING" || status === "SCHEDULED") return "amber";
  return "blue";
}

function latestTicketDescription(ticket) {
  if (!ticket) return "";
  const label = ticketStatusLabel(ticket.status, ticket.statusInterno).toLowerCase();
  if (ticket.statusInterno === "closed" || ticket.status === "RESOLVED") return "Seu atendimento foi concluído.";
  if (ticket.status === "WAITING_CUSTOMER") return "Seu atendimento está aguardando uma resposta.";
  return `Seu atendimento está ${label}.`;
}

function getPageKey(pathname) {
  const [, first, second] = pathname.split("/");
  if (first !== "cliente") return "inicio";
  return second || "inicio";
}

async function settle(promise) {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

function resolveErrorMessage(error, fallback) {
  if (error instanceof ClienteApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function firstName(name) {
  return String(name || "cliente").trim().split(/\s+/)[0] || "cliente";
}

function formatDate(value) {
  if (!value) return undefined;
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatBrazilianPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidBrazilianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

function formatAppointmentSchedule(appointment) {
  if (!appointment?.date) return undefined;

  const date = formatDate(appointment.date);
  if (!date) return undefined;

  const start = formatClockTime(appointment.windowStart);
  const end = formatClockTime(appointment.windowEnd);

  if (start && end) return `${date}, das ${start} às ${end}`;
  if (start) return `${date}, às ${start}`;
  return `${date}, horário a confirmar`;
}

function formatClockTime(value) {
  if (!value) return "";
  const match = String(value).match(/(?:^|T)(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function formatDateTime(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/**
 * Contrato cancelado/suspenso nunca deve aparecer como "offline": o
 * equipamento de um contrato encerrado costuma mesmo estar desligado/sem
 * sinal no SGP, mas isso nao e uma FALHA -- e o esperado. Mostrar "Internet
 * Offline" nesse caso da a impressao de problema tecnico onde nao ha
 * nenhum servico ativo pra falhar.
 */
function isServiceEnded(contract) {
  return contract?.status === "CANCELED" || contract?.status === "SUSPENDED";
}

function connectionLabel(connection, contract) {
  if (isServiceEnded(contract)) return "Serviço encerrado";
  if (!connection) return "Indisponível";
  if (isOfflineConnection(connection, contract)) return "Offline";
  if (connection.health === "NORMAL") return "Online";
  if (connection.health === "WARNING") return "Atenção";
  if (connection.health === "CRITICAL") return "Instável";
  // UNKNOWN (sem diagnóstico técnico recente) é deliberadamente diferente de
  // "Indisponível" (falha ao carregar) -- aqui os dados carregaram normalmente,
  // só não há sinal confiável pra dizer online/offline agora. Nunca mostrar
  // "Online" nesse caso só porque o contrato está ativo.
  if (connection.health === "UNKNOWN") return "Não confirmado";
  return "Não informado";
}

function connectionDetail(connection, contract) {
  if (isServiceEnded(contract)) {
    return contract?.status === "SUSPENDED"
      ? "Este contrato está suspenso -- nenhuma informação de conexão é exibida."
      : "Este contrato foi cancelado -- nenhuma informação de conexão é exibida.";
  }
  if (!connection) return "Dados de conexão não carregados";
  if (connection.knownIncident) return "Há um incidente conhecido na região";
  if (connection.onu === "OFFLINE" || connection.pppoe === "OFFLINE") return "Equipamento ou autenticação offline";
  if (connection.health === "NORMAL") return "Serviço operando normalmente";
  if (connection.health === "UNKNOWN") {
    return "Não foi possível confirmar o status técnico agora. Isso não significa que a conexão esteja com problema.";
  }
  return "Verifique os detalhes técnicos";
}

function connectionTone(connection, contract) {
  if (isServiceEnded(contract)) return "slate";
  if (!connection) return "blue";
  if (connection.health === "NORMAL") return "green";
  if (connection.health === "CRITICAL") return "red";
  if (connection.health === "UNKNOWN") return "slate";
  return "amber";
}

function billingValue(billing) {
  if (!billing) return "Indisponível";
  if (billing.amountOpen !== undefined) return formatCurrency(billing.amountOpen) || "Indisponível";
  return billingStatusLabel(billing.status);
}

function billingDetail(billing) {
  if (!billing) return "Resumo financeiro não carregado";
  if (billing.nextDueDate) return `Vence em ${formatDate(billing.nextDueDate)}`;
  if (billing.dueDay) return `Vencimento todo dia ${billing.dueDay}`;
  return billingStatusLabel(billing.status);
}

function billingTone(billing) {
  if (billing?.status === "PAID") return "green";
  if (billing?.status === "OVERDUE") return "red";
  if (billing?.status === "OPEN") return "amber";
  return "blue";
}

function isOfflineConnection(connection, contract) {
  if (isServiceEnded(contract)) {
    return false;
  }

  return Boolean(
    connection &&
      (connection.onu === "OFFLINE" ||
        connection.pon === "OFFLINE" ||
        connection.pppoe === "OFFLINE" ||
        connection.opticalSignal === "LOS")
  );
}

function billingStatusLabel(status) {
  const labels = {
    OPEN: "Em aberto",
    PAID: "Pago",
    OVERDUE: "Em atraso",
    UNKNOWN: "Não informado"
  };
  return labels[status] || "Não informado";
}

function invoiceStatusLabel(status) {
  const labels = {
    OPEN: "EM ABERTO",
    OVERDUE: "VENCIDA",
    PAID: "PAGA"
  };
  return labels[status] || "NÃO INFORMADO";
}

function invoiceStatusTone(status) {
  if (status === "PAID") return "green";
  if (status === "OVERDUE") return "red";
  return "amber";
}

function invoiceLateNotice(invoice) {
  const daysLate = Number(invoice?.daysLate);
  if (invoice?.status !== "OVERDUE" || !Number.isFinite(daysLate) || daysLate < 5) {
    return undefined;
  }

  if (daysLate >= 15) {
    return {
      tone: "red",
      message: "SUSPENSÃO POR CONTA DE ATRASO DE PAGAMENTO"
    };
  }

  return {
    tone: "amber",
    message: "REDUÇÃO DE INTERNET POR CONTA DE ATRASO DE PAGAMENTO"
  };
}

function invoiceEmptyTitle(status) {
  if (status === "PAID") return "Nenhuma fatura paga";
  if (status === "OVERDUE") return "Nenhuma fatura vencida";
  return "Nenhuma fatura em aberto";
}

function invoiceEmptyDescription(status) {
  if (status === "PAID") return "Os pagamentos confirmados pelo SGP aparecerão aqui.";
  if (status === "OVERDUE") return "Não há cobranças vencidas para este contrato.";
  return "Não há cobranças aguardando pagamento para este contrato.";
}

function invoiceListSummary(groupedInvoices) {
  const overdueCount = groupedInvoices.OVERDUE.length;
  const openCount = groupedInvoices.OPEN.length;

  if (overdueCount > 0 && openCount > 0) {
    return `${overdueCount} ${overdueCount === 1 ? "fatura vencida" : "faturas vencidas"} e ${openCount} em aberto`;
  }
  if (overdueCount > 0) {
    return `${overdueCount} ${overdueCount === 1 ? "fatura vencida" : "faturas vencidas"}`;
  }
  if (openCount > 0) {
    return `${openCount} ${openCount === 1 ? "fatura em aberto" : "faturas em aberto"}`;
  }
  return "Nenhuma fatura em aberto";
}

async function copyToClipboard(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // The fallback below also works when Clipboard API is blocked on local HTTP.
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(input);
  }
}

function contractStatusLabel(status) {
  const labels = {
    ACTIVE: "Ativo",
    SUSPENDED: "Suspenso",
    CANCELED: "Cancelado",
    UNKNOWN: "Não informado"
  };
  return labels[status] || "Não informado";
}

function technicalLabel(status) {
  const labels = {
    ONLINE: "Online",
    OFFLINE: "Offline",
    DEGRADED: "Degradado",
    UNKNOWN: "Não informado"
  };
  return labels[status] || "Não informado";
}

function opticalLabel(status) {
  const labels = {
    NORMAL: "Normal",
    WEAK: "Fraco",
    LOS: "LOS",
    UNKNOWN: "Não informado"
  };
  return labels[status] || "Não informado";
}

/**
 * Transparência sobre de onde ONU/PON/PPPoE vieram -- o SGP não expõe status
 * de conexão em tempo real (só texto de chamado), então "fonte" aqui nunca é
 * telemetria ao vivo. Ver ConnectionStatusSource no backend (types.ts).
 */
function statusSourceLabel(source) {
  const labels = {
    SGP_TICKET_DIAGNOSIS: "Último chamado técnico com diagnóstico",
    CONTRACT_STATUS: "Situação administrativa do contrato",
    NO_EVIDENCE: "Sem diagnóstico técnico recente disponível"
  };
  return labels[source] || "Não informado";
}

function ticketStatusLabel(status, internalStatus) {
  const internalLabels = {
    open: "Aberto",
    scheduled: "Agendado",
    in_progress: "Em atendimento",
    closed: "Encerrado"
  };
  const labels = {
    RECEIVED: "Recebido",
    ANALYZING: "Em análise",
    WAITING_CUSTOMER: "Aguardando cliente",
    FORWARDED: "Encaminhado",
    SCHEDULING: "Em agendamento",
    SCHEDULED: "Visita agendada",
    TECH_ON_THE_WAY: "Técnico a caminho",
    IN_PROGRESS: "Em atendimento",
    RESOLVED: "Concluído",
    CANCELED: "Cancelado"
  };

  return internalLabels[internalStatus] || labels[status] || status || "Não informado";
}

function normalizeTicketVisit(ticket, fallbackContractId) {
  if (!ticket) return null;
  const source = ticket.ticket || ticket;
  return {
    id: String(source.id || source.protocol || ""),
    protocol: source.protocol,
    contractId: source.contractId || fallbackContractId,
    status: source.status,
    statusInterno: source.statusInterno,
    title: source.title || "Atendimento",
    createdAt: source.createdAt || source.openedAt,
    updatedAt: source.updatedAt,
    appointment: source.appointment
  };
}

function getActiveTicket(currentTicket, tickets = [], contractId) {
  const current = normalizeTicketVisit(currentTicket, contractId);
  if (currentTicket?.active && current && (!contractId || current.contractId === contractId)) {
    const matchingTicket = tickets.find(
      (ticket) => ticket.id === current.id || (ticket.protocol && ticket.protocol === current.protocol)
    );
    const richerAppointment = appointmentScore(matchingTicket?.appointment) > appointmentScore(current.appointment)
      ? matchingTicket.appointment
      : current.appointment;

    return {
      ...matchingTicket,
      ...current,
      appointment: richerAppointment
    };
  }

  return tickets.find((ticket) => {
    if (contractId && ticket.contractId !== contractId) return false;
    return ticket.statusInterno !== "closed" && ticket.status !== "RESOLVED" && ticket.status !== "CANCELED";
  });
}

function appointmentScore(appointment) {
  if (!appointment?.date) return 0;
  if (appointment.windowStart && appointment.windowEnd) return 3;
  if (appointment.windowStart) return 2;
  return 1;
}

function dedupeTickets(tickets) {
  const map = new Map();
  tickets.forEach((ticket) => {
    if (ticket?.id) map.set(ticket.id, ticket);
  });
  return [...map.values()];
}

function normalizeConversation(input, ticket) {
  const now = new Date().toISOString();
  return {
    id: String(input?.id || input?.conversationId || input?.conversation_id || ""),
    ticketId: String(input?.ticketId || input?.ticket_id || ticket.id),
    ticketTitle: input?.ticketTitle || input?.ticket_title || ticket.title,
    status: input?.status || "open",
    createdAt: input?.createdAt || input?.created_at || now,
    updatedAt: input?.updatedAt || input?.updated_at || now
  };
}

function extractMessageArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeChatMessage(input, fallbackConversationId) {
  const source = input?.message && typeof input.message === "object" ? input.message : input;
  const role = source?.role || source?.authorRole || source?.author_role || source?.senderType || source?.sender_type;
  return {
    id: String(source?.id || source?.messageId || source?.message_id || source?.clientMessageId || source?.client_message_id || createClientMessageId()),
    conversationId: String(source?.conversationId || source?.conversation_id || fallbackConversationId),
    clientMessageId: source?.clientMessageId || source?.client_message_id,
    role: role === "customer" || role === "agent" || role === "system" ? role : "system",
    authorName: source?.authorName || source?.author_name || source?.senderName || source?.sender_name,
    body: String(source?.body || source?.message || source?.text || ""),
    createdAt: source?.createdAt || source?.created_at || new Date().toISOString(),
    pending: Boolean(source?.pending)
  };
}

function mergeChatMessages(current, incoming) {
  const map = new Map();

  [...current, ...incoming].forEach((message) => {
    const key = message.clientMessageId || message.id;
    map.set(key, { ...(map.get(key) || {}), ...message });
  });

  return [...map.values()].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}
