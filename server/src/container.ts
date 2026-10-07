import { InMemoryRateLimiter } from "./auth/rateLimiter.js";
import { TokenService } from "./auth/tokenService.js";
import { LocalPasswordAuthService } from "./auth/localPasswordAuthService.js";
import { CpfResolver } from "./auth/cpfResolver.js";
import { PasswordResetService } from "./auth/passwordResetService.js";
import { SmtpMailer, UnconfiguredMailer, type Mailer } from "./email/mailer.js";
import type { AppConfig, AppConfigOverrides } from "./config.js";
import { loadConfig } from "./config.js";
import {
  type AppointmentProvider,
  type BillingProvider,
  type ContractProvider,
  type NetworkProvider,
  type SignatureProvider,
  type TicketProvider,
  LocalAppointmentProvider,
  MockSgpBillingProvider,
  MockSgpContractProvider,
  MockSgpNetworkProvider,
  MockSgpTicketProvider,
  MockSignatureProvider,
  SgpBackedBillingProvider,
  SgpBackedContractProvider,
  SgpBackedNetworkProvider,
  SgpBackedSignatureProvider,
  SgpBackedTicketProvider,
  UnavailableSignatureProvider
} from "./integrations/sgp/providers.js";
import { SgpUraClient } from "./integrations/sgp/sgpClient.js";
import { OltCloudClient } from "./integrations/oltcloud/oltCloudClient.js";
import { OltCloudIncidentService } from "./integrations/oltcloud/oltCloudIncidentService.js";
import { RegionalIncidentService } from "./services/networkIncidentDetection/regionalIncidentService.js";
import { ClientRegionResolver } from "./services/networkIncidentDetection/clientRegionResolver.js";
import type { Pool } from "mysql2/promise";
import { InMemoryStore } from "./repositories/inMemoryStore.js";
import { createDatabase } from "./repositories/sqlite.js";
import { createMysqlPool, migrateMysql } from "./repositories/mysql.js";
import {
  SqliteAuthProfileRepository,
  MysqlAuthProfileRepository,
  type AuthProfileRepository
} from "./repositories/authProfileRepository.js";
import { SqliteSessionRepository, MysqlSessionRepository, type SessionRepository } from "./repositories/sessionRepository.js";
import {
  SqliteLoginAttemptRepository,
  MysqlLoginAttemptRepository,
  type LoginAttemptRepository
} from "./repositories/loginAttemptRepository.js";
import { SqliteAuditLogRepository, MysqlAuditLogRepository, type AuditLogRepository } from "./repositories/auditLogRepository.js";
import {
  SqlitePasswordResetRepository,
  MysqlPasswordResetRepository,
  type PasswordResetRepository
} from "./repositories/passwordResetRepository.js";
import { SupportService } from "./support/supportService.js";
import { AdminTicketService } from "./support/adminTicketService.js";
import { PaymentPromiseService } from "./billing/paymentPromiseService.js";
import { AdminAuthService } from "./services/adminAuthService.js";
import {
  SqliteAdminUserRepository,
  MysqlAdminUserRepository,
  type AdminUserRepository
} from "./repositories/adminUserRepository.js";
import {
  SqliteAdminSessionRepository,
  MysqlAdminSessionRepository,
  type AdminSessionRepository
} from "./repositories/adminSessionRepository.js";
import {
  SqliteAdminLoginAttemptRepository,
  MysqlAdminLoginAttemptRepository,
  type AdminLoginAttemptRepository
} from "./repositories/adminLoginAttemptRepository.js";
import {
  SqliteAdminAuditLogRepository,
  MysqlAdminAuditLogRepository,
  type AdminAuditLogRepository
} from "./repositories/adminAuditLogRepository.js";
import {
  SqliteNoticeRepository,
  MysqlNoticeRepository,
  type NoticeRepository
} from "./repositories/centralNoticeRepository.js";
import {
  SqliteNoticeViewRepository,
  MysqlNoticeViewRepository,
  type NoticeViewRepository
} from "./repositories/centralNoticeViewRepository.js";
import {
  SqliteCentralActivityRepository,
  MysqlCentralActivityRepository,
  type CentralActivityRepository
} from "./repositories/centralActivityRepository.js";
import {
  SqliteBugReportRepository,
  MysqlBugReportRepository,
  type BugReportRepository
} from "./repositories/bugReportRepository.js";
import {
  SqliteNetworkIncidentRepository,
  MysqlNetworkIncidentRepository,
  type NetworkIncidentRepository
} from "./repositories/networkIncidentRepository.js";
import { NoticeService } from "./notices/noticeService.js";
import { SignatureService } from "./signatures/signatureService.js";
import { CentralActivityService } from "./analytics/centralActivityService.js";
import { BugReportService } from "./services/bugReportService.js";

export interface AppContainer {
  config: AppConfig;
  store: InMemoryStore;
  rateLimiter: InMemoryRateLimiter;
  localPasswordAuthService: LocalPasswordAuthService;
  passwordResetService: PasswordResetService;
  supportService: SupportService;
  /** Le-somente: espelha pro admin os chamados abertos via Central (log de atividade OPEN_TICKET), enriquecidos ao vivo com o SGP -- ver server/src/support/adminTicketService.ts. */
  adminTicketService: AdminTicketService;
  /** Promessa de pagamento / liberacao por confianca -- SEMPRE chama o SGP de verdade, nunca simulado. Ver server/src/billing/paymentPromiseService.ts. */
  paymentPromiseService: PaymentPromiseService;
  providers: {
    contracts: ContractProvider;
    network: NetworkProvider;
    tickets: TicketProvider;
    appointments: AppointmentProvider;
    billing: BillingProvider;
    signatures: SignatureProvider;
  };
  authProfiles: AuthProfileRepository;
  authSessions: SessionRepository;
  loginAttempts: LoginAttemptRepository;
  authAuditLog: AuditLogRepository;
  passwordResets: PasswordResetRepository;
  mailer: Mailer;
  /** Modulo "Avisos da Central" -- autenticacao/dominio administrativos, independentes do login de cliente acima. */
  adminAuthService: AdminAuthService;
  adminUsers: AdminUserRepository;
  adminSessions: AdminSessionRepository;
  adminLoginAttempts: AdminLoginAttemptRepository;
  adminAuditLog: AdminAuditLogRepository;
  noticeRepository: NoticeRepository;
  noticeViews: NoticeViewRepository;
  noticeService: NoticeService;
  signatureService: SignatureService;
  centralActivityRepository: CentralActivityRepository;
  centralActivityService: CentralActivityService;
  bugReports: BugReportRepository;
  bugReportService: BugReportService;
  /** Incidentes PON_OUTAGE persistidos (alert/list pon_loss -> equipment/list -> external_client_contract_id) -- ver ponOutageSyncService.ts. Tabela sempre existe; so e alimentada quando oltCloud esta configurado (ver server.ts). */
  networkIncidents: NetworkIncidentRepository;
  /** Integracao OLT Cloud (somente leitura) -- undefined quando OLTCLOUD_BASE_URL/OLTCLOUD_TOKEN nao estao configurados. */
  oltCloud:
    | {
        client: OltCloudClient;
        service: OltCloudIncidentService;
        /** Correlacionador de instabilidade regional (CTO/PON/OLT) -- so existe junto com o client OLT Cloud, nunca sozinho. */
        regionalIncidents: RegionalIncidentService;
      }
    | undefined;
  /** Bairro/cidade de um contrato ja conhecido (SGP) -- so pra enriquecer o painel interno de incidentes, nunca pra correlacionar clientes em massa (ver clientRegionResolver.ts). */
  clientRegionResolver: ClientRegionResolver;
  /**
   * Exposto pra OwnershipService poder reverificar posse de contrato direto
   * no SGP quando o cache em memoria (InMemoryStore, nunca populado fora do
   * login -- ver cpfResolver.ts) estiver frio apos um restart do processo
   * (sessao sobrevive via refresh token, cache de contrato nao). Sempre
   * definido neste ponto (ver throw logo acima se sgpClient for undefined).
   */
  sgpClient: SgpUraClient;
  /**
   * Confirma conectividade do banco (SQLite ou MySQL, ver config.dbDriver)
   * pro health check (GET /api/health) -- abstrai os dois drivers atras de
   * uma unica funcao em vez de expor o handle bruto (que seria tipado
   * diferente em cada driver), nunca usar fora do health check sem passar
   * por um repository.
   */
  dbHealthCheck: () => Promise<boolean>;
  /**
   * Resolve quando o schema do banco esta pronto pra uso. SQLite migra de
   * forma sincrona dentro de createDatabase (ja resolvido quando chega
   * aqui); MySQL migra de forma assincrona (CREATE TABLE IF NOT EXISTS via
   * mysql2/promise) -- createContainer() continua sincrono de proposito
   * (buildApp tem um parametro default que chama createContainer()), entao
   * quem inicia o processo (server.ts) precisa dar `await container.dbReady`
   * antes de aceitar requests, senao a primeira query pode correr antes das
   * tabelas existirem.
   */
  dbReady: Promise<void>;
}

export function createContainer(configOverrides: AppConfigOverrides = {}): AppContainer {
  const config = loadConfig(configOverrides);
  const store = new InMemoryStore();
  const rateLimiter = new InMemoryRateLimiter();

  const sgpClient = config.sgp.enabled ? new SgpUraClient(config.sgp) : undefined;

  const mockContracts = new MockSgpContractProvider(store);
  const mockTickets = new MockSgpTicketProvider(store);

  const providers: AppContainer["providers"] = {
    contracts: sgpClient ? new SgpBackedContractProvider(mockContracts, sgpClient) : mockContracts,
    network: sgpClient
      ? new SgpBackedNetworkProvider(new MockSgpNetworkProvider(store), sgpClient)
      : new MockSgpNetworkProvider(store),
    tickets: sgpClient ? new SgpBackedTicketProvider(mockTickets, sgpClient, config.sgp.chamado) : mockTickets,
    appointments: new LocalAppointmentProvider(store),
    billing: sgpClient ? new SgpBackedBillingProvider(new MockSgpBillingProvider(), sgpClient) : new MockSgpBillingProvider(),
    /**
     * Condicionado em config.sgp.sign.enabled (chave propria), NUNCA so na
     * existencia de sgpClient -- sgpClient e sempre nao-nulo neste container
     * (ver throw abaixo), diferente dos outros providers acima.
     */
    signatures: config.sgp.sign.enabled && sgpClient
      ? new SgpBackedSignatureProvider(new UnavailableSignatureProvider(), sgpClient)
      : config.sgpSignMock.enabled
        ? new MockSignatureProvider()
        : new UnavailableSignatureProvider()
  };

  let authProfiles: AuthProfileRepository;
  let authSessions: SessionRepository;
  let loginAttempts: LoginAttemptRepository;
  let authAuditLog: AuditLogRepository;
  let passwordResets: PasswordResetRepository;
  let adminUsers: AdminUserRepository;
  let adminSessions: AdminSessionRepository;
  let adminLoginAttempts: AdminLoginAttemptRepository;
  let adminAuditLog: AdminAuditLogRepository;
  let noticeRepository: NoticeRepository;
  let noticeViews: NoticeViewRepository;
  let centralActivityRepository: CentralActivityRepository;
  let bugReports: BugReportRepository;
  let networkIncidents: NetworkIncidentRepository;
  let dbHealthCheck: () => Promise<boolean>;
  let dbReady: Promise<void>;

  if (config.dbDriver === "mysql") {
    const pool: Pool = createMysqlPool(config.mysql);
    dbReady = migrateMysql(pool);
    dbHealthCheck = async () => {
      try {
        await pool.query("SELECT 1");
        return true;
      } catch {
        return false;
      }
    };

    authProfiles = new MysqlAuthProfileRepository(pool);
    authSessions = new MysqlSessionRepository(pool);
    loginAttempts = new MysqlLoginAttemptRepository(pool);
    authAuditLog = new MysqlAuditLogRepository(pool);
    passwordResets = new MysqlPasswordResetRepository(pool);
    adminUsers = new MysqlAdminUserRepository(pool);
    adminSessions = new MysqlAdminSessionRepository(pool);
    adminLoginAttempts = new MysqlAdminLoginAttemptRepository(pool);
    adminAuditLog = new MysqlAdminAuditLogRepository(pool);
    noticeRepository = new MysqlNoticeRepository(pool);
    noticeViews = new MysqlNoticeViewRepository(pool);
    centralActivityRepository = new MysqlCentralActivityRepository(pool);
    bugReports = new MysqlBugReportRepository(pool);
    networkIncidents = new MysqlNetworkIncidentRepository(pool);
  } else {
    const db = createDatabase(config.sqlitePath);
    dbReady = Promise.resolve();
    dbHealthCheck = async () => {
      try {
        db.prepare("SELECT 1").get();
        return true;
      } catch {
        return false;
      }
    };

    authProfiles = new SqliteAuthProfileRepository(db);
    authSessions = new SqliteSessionRepository(db);
    loginAttempts = new SqliteLoginAttemptRepository(db);
    authAuditLog = new SqliteAuditLogRepository(db);
    passwordResets = new SqlitePasswordResetRepository(db);
    adminUsers = new SqliteAdminUserRepository(db);
    adminSessions = new SqliteAdminSessionRepository(db);
    adminLoginAttempts = new SqliteAdminLoginAttemptRepository(db);
    adminAuditLog = new SqliteAdminAuditLogRepository(db);
    noticeRepository = new SqliteNoticeRepository(db);
    noticeViews = new SqliteNoticeViewRepository(db);
    centralActivityRepository = new SqliteCentralActivityRepository(db);
    bugReports = new SqliteBugReportRepository(db);
    networkIncidents = new SqliteNetworkIncidentRepository(db);
  }

  const mailer: Mailer = config.smtp.enabled ? new SmtpMailer(config.smtp) : new UnconfiguredMailer();

  if (!sgpClient) {
    throw new Error(
      "SGP nao configurado (SGP_APP/SGP_TOKEN ou SGP_BASIC_USERNAME/SGP_BASIC_PASSWORD ausentes). " +
        "Este backend depende do SGP para autenticar clientes -- nao ha modo mock."
    );
  }

  const cpfResolver = new CpfResolver(store, sgpClient);
  const clientRegionResolver = new ClientRegionResolver(sgpClient);

  const localPasswordAuthService = new LocalPasswordAuthService(
    config,
    { resolve: cpfResolver.resolve.bind(cpfResolver) },
    authProfiles,
    authSessions,
    loginAttempts,
    authAuditLog,
    rateLimiter
  );

  const passwordResetService = new PasswordResetService(
    config,
    { resolve: cpfResolver.resolve.bind(cpfResolver) },
    authProfiles,
    authSessions,
    passwordResets,
    mailer,
    authAuditLog,
    rateLimiter
  );

  const supportService = new SupportService(
    store,
    providers.network,
    providers.tickets,
    providers.appointments,
    providers.billing,
    sgpClient
  );

  const adminTicketService = new AdminTicketService(centralActivityRepository, providers.tickets, providers.contracts);

  const adminAuthService = new AdminAuthService(config, adminUsers, adminSessions, adminLoginAttempts, rateLimiter);
  const noticeService = new NoticeService(noticeRepository, noticeViews, adminAuditLog);
  const signatureService = new SignatureService(store, providers.signatures, sgpClient);
  const centralActivityService = new CentralActivityService(centralActivityRepository, authProfiles, store);
  const bugReportService = new BugReportService(bugReports, store, authProfiles, rateLimiter, sgpClient);
  const paymentPromiseService = new PaymentPromiseService(providers.billing, centralActivityService, rateLimiter);

  const oltCloud = config.oltCloud.enabled
    ? (() => {
        const client = new OltCloudClient(
          { baseUrl: config.oltCloud.baseUrl, token: config.oltCloud.token ?? "", timeoutMs: config.oltCloud.timeoutMs },
          (entry) => console.log(`[oltcloud] ${entry.timestamp} ${entry.endpoint} status=${entry.status ?? "n/a"} ok=${entry.ok} durationMs=${entry.durationMs}`)
        );
        const regionalIncidents = new RegionalIncidentService(client, config.regionalIncident, (entry) =>
          console.log(`[regional-incident] ${JSON.stringify(entry)}`)
        );
        return { client, service: new OltCloudIncidentService(client, config.oltCloud.cacheTtlMs), regionalIncidents };
      })()
    : undefined;

  return {
    config,
    store,
    rateLimiter,
    localPasswordAuthService,
    passwordResetService,
    supportService,
    adminTicketService,
    paymentPromiseService,
    providers,
    authProfiles,
    authSessions,
    loginAttempts,
    authAuditLog,
    passwordResets,
    mailer,
    adminAuthService,
    adminUsers,
    adminSessions,
    adminLoginAttempts,
    adminAuditLog,
    noticeRepository,
    noticeViews,
    noticeService,
    signatureService,
    centralActivityRepository,
    centralActivityService,
    bugReports,
    bugReportService,
    networkIncidents,
    oltCloud,
    clientRegionResolver,
    sgpClient,
    dbHealthCheck,
    dbReady
  };
}

export { TokenService };
