import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config();
dotenv.config({ path: path.join(serverRoot, ".env") });

export interface AppConfig {
  env: "development" | "test" | "production";
  port: number;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  /** Secret separado do de cliente -- comprometer um token de cliente nunca deve permitir forjar um token admin. */
  adminJwtSecret: string;
  adminAccessTokenTtlSeconds: number;
  adminRefreshTokenTtlSeconds: number;
  corsOrigins: string[] | true;
  sgp: {
    enabled: boolean;
    baseUrl: string;
    app: string | undefined;
    token: string | undefined;
    basicUsername: string | undefined;
    basicPassword: string | undefined;
    timeoutMs: number;
    cpfSearchFields: string[];
    chamado: {
      app: string | undefined;
      token: string | undefined;
      timeoutMs: number;
      semOs: string | undefined;
      mapping: Record<string, { ocorrenciaTipo: string; motivoOs: string }>;
    };
    /**
     * Assinaturas eletronicas (SGPSign). "enabled" e uma chave PROPRIA
     * (SGP_SIGN_ENABLED), nunca derivada so de SGP_APP/SGP_TOKEN existirem
     * (esses ja sao obrigatorios para login) -- sem isso, o provider real
     * ligaria sozinho no dia em que o metodo fosse implementado, sem
     * validacao previa contra o SGP real. Hoje nao ha endpoint confirmado;
     * ver server/src/integrations/sgp/providers.ts (SignatureProvider).
     */
    sign: {
      enabled: boolean;
      app: string | undefined;
      token: string | undefined;
      timeoutMs: number;
    };
  };
  /**
   * Dados fake de assinatura pendente so para construir/testar a UI antes do
   * endpoint real do SGPSign existir. SEMPRE false em producao, independente
   * do valor da env var (trava abaixo em loadConfig) -- nunca deve aparecer
   * para um cliente real.
   */
  sgpSignMock: {
    enabled: boolean;
  };
  oltCloud: {
    /** Somente leitura -- ver server/src/integrations/oltcloud. Nunca usar este client para POST/PUT/PATCH/DELETE. */
    enabled: boolean;
    baseUrl: string;
    token: string | undefined;
    timeoutMs: number;
    /** TTL do cache de status de incidente por cliente (evita 1 chamada a OLT Cloud por render da Central). */
    cacheTtlMs: number;
    debug: {
      /** GET /api/debug/oltcloud/client-status/:contractId -- rota de teste, nunca deve ficar exposta em producao sem token. */
      enabled: boolean;
      token: string | undefined;
    };
  };
  /**
   * Sincronizacao periodica de queda massiva de PON (alert/list -> pon_loss
   * -> equipment/list -> external_client_contract_id -> network_incidents).
   * So roda quando oltCloud.enabled -- ver startPonOutageSync em server.ts.
   */
  ponOutageSync: {
    intervalSeconds: number;
  };
  /** Deteccao de instabilidade regional (server/src/services/networkIncidentDetection) -- consome oltCloud, nunca chama a OLT Cloud diretamente por conta propria. */
  regionalIncident: {
    /** Quantidade minima de dispositivos/clientes correlacionados pra virar "high"/"confirmed" (abaixo disso fica low/medium e nunca vira incidente exposto ao cliente). */
    minClients: number;
    /** Janela de tempo pra considerar eventos correlacionados (mesma infra, inicio proximo). */
    windowMinutes: number;
    /** So usado se/quando existir fonte real de latitude/longitude (hoje nao existe -- ver clientRegionResolver.ts). */
    radiusMeters: number;
    /** Depois de quanto tempo sem evidencia nova um incidente confirmado vira "resolved" (passando por "recovering" antes). */
    recoveryWindowMinutes: number;
    /** TTL do cache do refresh de alertas da OLT Cloud usado pelo correlacionador. */
    refreshTtlMs: number;
    /** TTL do cache do probe de equipment/list (fallback quando ainda nao ha alerta oficial da OLT Cloud). */
    equipmentProbeTtlMs: number;
  };
  /** Segredo usado para HMAC-SHA256 do CPF normalizado (customer_auth_profiles.cpf_hash). Nunca reaproveitar para outra finalidade. */
  cpfHashSecret: string;
  /** Segredo usado para HMAC-SHA256 do codigo OTP (password_reset_requests.otp_hash). Espaco de busca pequeno (6 digitos) -- nunca hashear com sha256 puro nem reaproveitar este segredo para outra finalidade. */
  otpHashSecret: string;
  /** Caminho do arquivo SQLite com os dados de autenticacao (senha, sessao, tentativas, auditoria). So usado quando dbDriver === "sqlite". */
  sqlitePath: string;
  /**
   * "sqlite" (default, arquivo local via node:sqlite) ou "mysql" (banco
   * gerenciado pela Hostinger, fora da pasta que o deploy apaga/recria --
   * ver deploy-hostinger.sh e o backup automatico de auth.sqlite). Trocar
   * exige so DB_DRIVER=mysql no .env + reiniciar; nenhum redeploy de
   * codigo necessario pra reverter, de proposito (rollback instantaneo
   * durante o periodo de validacao da migracao).
   */
  dbDriver: "sqlite" | "mysql";
  mysql: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  /**
   * Diretorio do build do frontend servido estaticamente em producao (ver
   * app.ts). Resolvido a partir do cwd do processo (nao do import.meta.url
   * deste arquivo) porque o layout de build do pacote de deploy fica em
   * profundidade diferente do layout de dev (server/src/config.ts) -- cwd
   * e a unica referencia estavel nos dois casos (processo sempre iniciado
   * a partir da raiz do projeto/deploy). Default "<cwd>/public" -- irmao
   * de "dist/" (onde o backend compilado fica), nunca dentro dele, pra nao
   * colidir com os arquivos compilados do backend. So importa quando o
   * diretorio existe (ver staticDirExists em app.ts); em dev normal (vite
   * dev separado) fica inerte.
   */
  staticDir: string;
  /**
   * Identifica a build/deploy atual do backend (ver GET /api/health). Vem de
   * APP_VERSION, setado no .env de cada deploy -- nao calculado em runtime
   * (nao ha hash de git/commit disponivel no pacote de deploy, so o dist/
   * compilado). Sem APP_VERSION definido, cai no timestamp de boot do
   * processo: nao identifica a build, mas ja distingue "reiniciou depois do
   * meu deploy" de "processo antigo ainda rodando", o caso mais comum de
   * diagnostico.
   */
  appVersion: string;
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
    from: string;
  };
}

export type AppConfigOverrides = Partial<Omit<AppConfig, "sgp" | "oltCloud" | "regionalIncident" | "sgpSignMock">> & {
  sgp?: Partial<Omit<AppConfig["sgp"], "chamado" | "sign">> & {
    chamado?: Partial<AppConfig["sgp"]["chamado"]>;
    sign?: Partial<AppConfig["sgp"]["sign"]>;
  };
  oltCloud?: Partial<Omit<AppConfig["oltCloud"], "debug">> & { debug?: Partial<AppConfig["oltCloud"]["debug"]> };
  regionalIncident?: Partial<AppConfig["regionalIncident"]>;
  sgpSignMock?: Partial<AppConfig["sgpSignMock"]>;
};

export function loadConfig(overrides: AppConfigOverrides = {}): AppConfig {
  const env = (overrides.env ?? (process.env.NODE_ENV as AppConfig["env"]) ?? "development") as AppConfig["env"];

  const jwtSecret = process.env.JWT_SECRET ?? (env === "production" ? "" : "local-dev-jwt-secret-change-me");
  const cpfHashSecret = process.env.CPF_HASH_SECRET ?? (env === "production" ? "" : "local-dev-cpf-hash-secret-change-me");
  const otpHashSecret = process.env.OTP_HASH_SECRET ?? (env === "production" ? "" : "local-dev-otp-hash-secret-change-me");
  const adminJwtSecret = process.env.ADMIN_JWT_SECRET ?? (env === "production" ? "" : "local-dev-admin-jwt-secret-change-me");

  if (env === "production" && jwtSecret.length < 32 && !overrides.jwtSecret) {
    throw new Error("JWT_SECRET must contain at least 32 characters in production.");
  }
  if (env === "production" && cpfHashSecret.length < 32 && !overrides.cpfHashSecret) {
    throw new Error("CPF_HASH_SECRET must contain at least 32 characters in production.");
  }
  if (env === "production" && otpHashSecret.length < 32 && !overrides.otpHashSecret) {
    throw new Error("OTP_HASH_SECRET must contain at least 32 characters in production.");
  }
  if (env === "production" && adminJwtSecret.length < 32 && !overrides.adminJwtSecret) {
    throw new Error("ADMIN_JWT_SECRET must contain at least 32 characters in production.");
  }

  const corsOriginsEnv = process.env.CORS_ORIGINS?.trim();

  const base: AppConfig = {
    env,
    port: Number(process.env.PORT ?? 9531),
    jwtSecret,
    accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
    refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30),
    adminJwtSecret,
    adminAccessTokenTtlSeconds: Number(process.env.ADMIN_ACCESS_TOKEN_TTL_SECONDS ?? 900),
    adminRefreshTokenTtlSeconds: Number(process.env.ADMIN_REFRESH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7),
    corsOrigins: corsOriginsEnv ? parseCsv(corsOriginsEnv) : true,
    sgp: {
      enabled: Boolean(
        (process.env.SGP_APP && process.env.SGP_TOKEN) ||
          (process.env.SGP_BASIC_USERNAME && process.env.SGP_BASIC_PASSWORD)
      ),
      baseUrl: process.env.SGP_BASE_URL ?? "https://acessanet.sgp.net.br",
      app: unwrapEnv(process.env.SGP_APP),
      token: unwrapEnv(process.env.SGP_TOKEN),
      basicUsername: unwrapEnv(process.env.SGP_BASIC_USERNAME),
      basicPassword: unwrapEnv(process.env.SGP_BASIC_PASSWORD),
      timeoutMs: Number(process.env.SGP_TIMEOUT_MS ?? 8000),
      cpfSearchFields: parseCsv(process.env.SGP_CPF_SEARCH_FIELDS ?? "cpfcnpj,cpf_cnpj,cpfCnpj,cpf"),
      chamado: {
        app: unwrapEnv(process.env.SGP_CHAMADO_APP) ?? unwrapEnv(process.env.SGP_APP),
        token: unwrapEnv(process.env.SGP_CHAMADO_TOKEN) ?? unwrapEnv(process.env.SGP_TOKEN),
        timeoutMs: Number(process.env.SGP_CHAMADO_TIMEOUT_MS ?? 15000),
        semOs: unwrapEnv(process.env.SGP_CHAMADO_SEM_OS),
        mapping: parseChamadoMapping(process.env.SGP_CHAMADO_MAPPING)
      },
      sign: {
        /**
         * Chave PROPRIA (SGP_SIGN_ENABLED) -- deliberadamente nao derivada
         * de SGP_APP/SGP_TOKEN existirem, ver comentario no tipo AppConfig.
         */
        enabled: process.env.SGP_SIGN_ENABLED === "true",
        app: unwrapEnv(process.env.SGP_SIGN_APP) ?? unwrapEnv(process.env.SGP_APP),
        token: unwrapEnv(process.env.SGP_SIGN_TOKEN) ?? unwrapEnv(process.env.SGP_TOKEN),
        timeoutMs: Number(process.env.SGP_SIGN_TIMEOUT_MS ?? 10000)
      }
    },
    sgpSignMock: {
      /** Trava de seguranca: nunca true em producao, independente da env var. */
      enabled: env !== "production" && process.env.SGP_SIGN_MOCK_ENABLED === "true"
    },
    oltCloud: {
      enabled: Boolean(process.env.OLTCLOUD_BASE_URL && process.env.OLTCLOUD_TOKEN),
      baseUrl: process.env.OLTCLOUD_BASE_URL ?? "",
      token: unwrapEnv(process.env.OLTCLOUD_TOKEN),
      timeoutMs: Number(process.env.OLTCLOUD_TIMEOUT_MS ?? 8000),
      cacheTtlMs: Number(process.env.OLTCLOUD_CACHE_TTL_MS ?? 45000),
      debug: {
        enabled:
          process.env.OLTCLOUD_DEBUG_ENABLED !== undefined
            ? process.env.OLTCLOUD_DEBUG_ENABLED === "true"
            : env !== "production",
        token: unwrapEnv(process.env.OLTCLOUD_DEBUG_TOKEN)
      }
    },
    ponOutageSync: {
      intervalSeconds: Number(process.env.OLT_PON_OUTAGE_SYNC_INTERVAL_SECONDS ?? 60)
    },
    regionalIncident: {
      minClients: Number(process.env.REGIONAL_INCIDENT_MIN_CLIENTS ?? 3),
      windowMinutes: Number(process.env.REGIONAL_INCIDENT_WINDOW_MINUTES ?? 10),
      radiusMeters: Number(process.env.REGIONAL_INCIDENT_RADIUS_METERS ?? 800),
      recoveryWindowMinutes: Number(process.env.REGIONAL_INCIDENT_RECOVERY_WINDOW_MINUTES ?? 5),
      refreshTtlMs: Number(process.env.REGIONAL_INCIDENT_REFRESH_TTL_MS ?? 45000),
      equipmentProbeTtlMs: Number(process.env.REGIONAL_INCIDENT_EQUIPMENT_PROBE_TTL_MS ?? 45000)
    },
    cpfHashSecret,
    otpHashSecret,
    sqlitePath: process.env.SQLITE_PATH ?? path.join(serverRoot, "data", "auth.sqlite"),
    dbDriver: process.env.DB_DRIVER === "mysql" ? "mysql" : "sqlite",
    mysql: {
      host: process.env.MYSQL_HOST ?? "localhost",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "",
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE ?? ""
    },
    staticDir: process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : path.resolve(process.cwd(), "public"),
    appVersion: process.env.APP_VERSION ?? `boot-${new Date().toISOString()}`,
    smtp: {
      enabled: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      host: process.env.SMTP_HOST ?? "",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: (process.env.SMTP_SECURE ?? "true") !== "false",
      user: unwrapEnv(process.env.SMTP_USER),
      pass: unwrapEnv(process.env.SMTP_PASS),
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? ""
    }
  };

  return {
    ...base,
    ...overrides,
    sgp: {
      ...base.sgp,
      ...overrides.sgp,
      chamado: { ...base.sgp.chamado, ...overrides.sgp?.chamado },
      sign: { ...base.sgp.sign, ...overrides.sgp?.sign }
    },
    oltCloud: {
      ...base.oltCloud,
      ...overrides.oltCloud,
      debug: { ...base.oltCloud.debug, ...overrides.oltCloud?.debug }
    },
    regionalIncident: {
      ...base.regionalIncident,
      ...overrides.regionalIncident
    },
    sgpSignMock: {
      /** Trava de seguranca reaplicada aqui: nenhum override pode ligar mock em producao. */
      enabled: env !== "production" && (overrides.sgpSignMock?.enabled ?? base.sgpSignMock.enabled)
    }
  };
}

function parseChamadoMapping(value: string | undefined): Record<string, { ocorrenciaTipo: string; motivoOs: string }> {
  if (!value || !value.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      "SGP_CHAMADO_MAPPING precisa ser um JSON valido, ex: " +
        '{"FALHA_REDE_ACESSO":{"ocorrenciaTipo":"3","motivoOs":"12"}}'
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("SGP_CHAMADO_MAPPING precisa ser um objeto JSON (classificacao -> {ocorrenciaTipo, motivoOs}).");
  }

  const mapping: Record<string, { ocorrenciaTipo: string; motivoOs: string }> = {};
  for (const [classification, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      throw new Error(`SGP_CHAMADO_MAPPING: entrada invalida para "${classification}".`);
    }

    const ocorrenciaTipo = String((entry as Record<string, unknown>).ocorrenciaTipo ?? "").trim();
    const motivoOs = String((entry as Record<string, unknown>).motivoOs ?? "").trim();
    if (!ocorrenciaTipo || !motivoOs) {
      throw new Error(
        `SGP_CHAMADO_MAPPING: "${classification}" precisa de ocorrenciaTipo e motivoOs nao vazios.`
      );
    }

    mapping[classification] = { ocorrenciaTipo, motivoOs };
  }

  return mapping;
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function unwrapEnv(value: string | undefined) {
  if (!value) {
    return value;
  }
  return value.trim().replace(/^["']|["']$/g, "") || undefined;
}
