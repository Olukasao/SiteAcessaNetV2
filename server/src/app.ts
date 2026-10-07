import fs from "node:fs";
import path from "node:path";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { createAuthenticateHook } from "./auth/authenticate.js";
import { createAdminAuthenticateHook } from "./auth/adminAuthenticate.js";
import type { AppContainer } from "./container.js";
import { createContainer } from "./container.js";
import { errorHandler } from "./errors.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerLocalAuthRoutes } from "./routes/localAuthRoutes.js";
import { registerContractRoutes } from "./routes/contractRoutes.js";
import { registerSupportRoutes } from "./routes/supportRoutes.js";
import { registerSignatureRoutes } from "./routes/signatureRoutes.js";
import { registerAdminAuthRoutes } from "./routes/adminAuthRoutes.js";
import { registerAdminNoticeRoutes } from "./routes/adminNoticeRoutes.js";
import { registerNoticeRoutes } from "./routes/noticeRoutes.js";
import { registerDebugOltCloudRoutes } from "./routes/debugOltCloudRoutes.js";
import { registerCentralNetworkStatusRoutes } from "./routes/centralNetworkStatusRoutes.js";
import { registerCentralActivityRoutes } from "./routes/centralActivityRoutes.js";
import { registerAdminNetworkIncidentRoutes } from "./routes/adminNetworkIncidentRoutes.js";
import { registerAdminAnalyticsRoutes } from "./routes/adminAnalyticsRoutes.js";
import { registerAdminTicketRoutes } from "./routes/adminTicketRoutes.js";
import { registerBugReportRoutes } from "./routes/bugReportRoutes.js";

export async function buildApp(container: AppContainer = createContainer()) {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.authorization",
        "req.body.password",
        "req.body.newPassword",
        "req.body.confirmPassword",
        "req.body.refreshToken",
        "res.headers.set-cookie"
      ]
    }
  });

  app.setErrorHandler(errorHandler);
  await app.register(helmet, {
    /**
     * CSP desligado de proposito: o build do frontend (index.html) usa um
     * <style> inline grande e carrega fontes do Google Fonts entre
     * dominios -- o CSP default do helmet ('self' em style-src/font-src)
     * bloquearia os dois. O site nunca rodou atras de CSP antes (deploy
     * anterior era Apache estatico, sem helmet), entao desligar aqui so
     * mantem o comportamento visual que ja existia em producao. As outras
     * protecoes do helmet (X-Frame-Options, noSniff, etc.) continuam ativas.
     */
    contentSecurityPolicy: false
  });
  await app.register(cors, {
    origin: container.config.corsOrigins,
    /**
     * O default do @fastify/cors so libera GET/HEAD/POST no preflight --
     * sem isso, PUT/DELETE (editar/excluir aviso) sao bloqueados pelo
     * navegador antes mesmo de chegar no servidor (curl nao mostra o
     * problema porque nao aplica CORS).
     */
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    credentials: false
  });

  const authenticate = createAuthenticateHook(container.localPasswordAuthService.tokens, container.authSessions);
  const adminAuthenticate = createAdminAuthenticateHook(container.adminAuthService.tokens, container.adminSessions);

  /**
   * Nunca deixar resposta de API ficar em cache (nem navegador, nem CDN/proxy
   * intermediario) -- dado de contrato/fatura/status de conexao desatualizado
   * exibido pro cliente e muito pior que uma chamada a mais. Hook global (nao
   * por rota) pra nenhuma rota nova esquecer disso.
   */
  app.addHook("onSend", async (request, reply, payload) => {
    const url = request.raw.url || "";
    if (
      url.startsWith("/api") ||
      url.startsWith("/v1") ||
      url.startsWith("/admin/api") ||
      url.startsWith("/health") ||
      url.startsWith("/ready")
    ) {
      reply.header("Cache-Control", "no-store");
    }
    return payload;
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async () => ({
    status: "ready",
    integrations: {
      sgp: container.config.sgp.enabled ? "enabled" : "disabled",
      sgpChamado: container.config.sgp.chamado.app && container.config.sgp.chamado.token ? "configured" : "not_configured",
      sgpChamadoMapping: Object.keys(container.config.sgp.chamado.mapping).length,
      sgpSign: container.config.sgp.sign.enabled ? "enabled" : "disabled",
      oltCloud: container.config.oltCloud.enabled ? "enabled" : "disabled"
    }
  }));
  /**
   * Alias de /health pensado pro painel da hospedagem (health check de
   * deploy). Nunca consulta o SGP/OLT Cloud (seriam chamadas de rede
   * externas a cada ping) -- so confirma que o processo sobe e que o banco
   * de autenticacao (SQLite ou MySQL, ver config.dbDriver) responde. Nao
   * expoe caminho de arquivo/host nem nenhum outro detalhe interno.
   */
  app.get("/api/health", async () => {
    const database = (await container.dbHealthCheck()) ? "ok" : "error";
    return {
      status: "ok",
      environment: container.config.env,
      database,
      dbDriver: container.config.dbDriver,
      version: container.config.appVersion
    };
  });

  /**
   * Versao do BUILD DO FRONTEND (gerada pelo vite.config.js em dist/version.json
   * a cada `npm run build`), consumida por VersionWatcher.jsx pra detectar aba
   * antiga. Nao serve o arquivo direto do public/ (@fastify/static) porque
   * requests de arquivo estatico com extensao reconhecida (.json incluso)
   * parecem ser atendidas direto pela borda/CDN da hospedagem sem passar por
   * este processo -- a resposta sai sem nenhum Cache-Control, podendo ficar
   * presa em cache de CDN/proxy intermediario indefinidamente, o que
   * inutilizaria completamente a deteccao de versao nova. Uma rota sob /api
   * sempre chega aqui (ver hook global de no-store acima) e sempre reflete o
   * arquivo mais recente no disco.
   */
  app.get("/api/frontend-version", async (request, reply) => {
    try {
      const content = fs.readFileSync(path.join(container.config.staticDir, "version.json"), "utf-8");
      reply.type("application/json");
      return content;
    } catch {
      reply.code(404);
      return { error: { code: "NOT_FOUND", message: "version.json nao encontrado." } };
    }
  });

  /**
   * Serve o build do frontend (vite build -> ./dist, path.resolve a partir
   * do cwd do processo) quando ele existe. Em dev (vite dev separado, sem
   * build gerado) fica inerte -- nenhuma rota nova e registrada. Precisa
   * vir registrado antes do setNotFoundHandler abaixo, que usa
   * staticDirExists pra decidir se cai no fallback de SPA ou no 404 JSON.
   */
  const staticDirExists = fs.existsSync(container.config.staticDir);
  if (staticDirExists) {
    await app.register(fastifyStatic, {
      root: container.config.staticDir,
      index: ["index.html"],
      /**
       * CAUSA RAIZ do "site as vezes trava, so resolve com Ctrl+F5" (ver
       * memoria/relatorio de cache): o deploy tinha um public/.htaccess com
       * essa mesma intencao, mas em producao quem serve isso e o Fastify
       * (Node), nao Apache -- .htaccess nunca e lido. Pior: mesmo onde o
       * provedor de hospedagem aplicava algo parecido por conta propria, so
       * cobria literalmente "/index.html" (regra `FilesMatch \.html$`) --
       * nunca "/", "/planos", "/cliente" etc, que sao como usuario de
       * verdade navega. Essas rotas caiam no default do @fastify/static
       * (Cache-Control: public, max-age=0, sem must-revalidate), fraco o
       * bastante pra alguns navegadores/proxies intermediarios ocasionalmente
       * reaproveitarem o index.html antigo -- daí index.html velho + chunk
       * .js com hash que já não existe mais apos um deploy.
       *
       * Aqui SEMPRE fica explicito, no proprio app, independente de qualquer
       * comportamento de CDN/proxy da hospedagem:
       *   - /assets/* (nome com hash de conteudo do build do Vite) -> cache
       *     longo e imutavel, pode confiar 100% porque qualquer mudanca gera
       *     um nome de arquivo novo.
       *   - tudo mais servido por aqui (index.html, favicon, robots.txt etc,
       *     nome de arquivo NAO muda entre deploys) -> sempre revalidar.
       */
      setHeaders: (reply, filePath) => {
        const cacheControl = /[\\/]assets[\\/]/.test(filePath)
          ? "public, max-age=31536000, immutable"
          : "no-cache, must-revalidate";
        reply.header("Cache-Control", cacheControl);
      }
    });
  }

  app.setNotFoundHandler(async (request, reply) => {
    const url = request.url;
    const isBackendPath =
      url.startsWith("/api") || url.startsWith("/v1") || url.startsWith("/admin/api") || url.startsWith("/health") || url.startsWith("/ready");

    /**
     * Fallback de SPA (React Router): qualquer GET que nao seja de backend
     * e nao bateu em nenhum arquivo estatico real (@fastify/static ja
     * tentou servir o arquivo antes de cair aqui) recebe o index.html, pra
     * rotas como /login ou /meu-plano nao virarem 404 ao atualizar a
     * pagina. Rotas de backend continuam retornando 404 em JSON.
     */
    if (!isBackendPath && request.method === "GET" && staticDirExists) {
      return reply.sendFile("index.html");
    }

    return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
  });

  await registerLocalAuthRoutes(app, container);
  await registerAuthRoutes(app, container);

  app.addHook("preHandler", async (request, reply) => {
    const url = request.url;

    if (!url.startsWith("/api") && !url.startsWith("/v1")) {
      return;
    }

    const publicRoutes = new Set([
      "GET /health",
      "GET /ready",
      "GET /api/health",
      "GET /api/frontend-version",
      "POST /api/auth/local/check",
      "POST /api/auth/local/setup",
      "POST /api/auth/local/login",
      "POST /api/auth/local/forgot-password",
      "POST /api/auth/local/forgot-password/masked-email",
      "POST /api/auth/local/verify-reset-code",
      "POST /api/auth/local/reset-password",
      "POST /v1/auth/refresh",
      /**
       * Rota de teste da integracao OLT Cloud -- nao usa sessao de cliente,
       * tem sua propria protecao (x-debug-token + so registrada fora de
       * producao por padrao, ver registerDebugOltCloudRoutes).
       */
      "GET /api/debug/oltcloud/client-status/:contractId"
    ]);
    const key = `${request.method} ${request.routeOptions?.url || url}`;
    if (publicRoutes.has(key)) {
      return;
    }

    await authenticate(request, reply);
  });

  /**
   * Segundo hook global, paralelo ao de cima: guardado por "/admin/api" em
   * vez de "/api"/"/v1", entao os dois nunca colidem -- rotas admin nunca
   * passam pela autenticacao de cliente e vice-versa. Roda em toda
   * requisicao (igual ao hook acima ja faz pra fora de /api//v1), mas
   * retorna cedo pra fora de /admin/api.
   */
  app.addHook("preHandler", async (request, reply) => {
    const url = request.url;

    if (!url.startsWith("/admin/api")) {
      return;
    }

    const publicAdminRoutes = new Set(["POST /admin/api/auth/login", "POST /admin/api/auth/refresh"]);
    const key = `${request.method} ${request.routeOptions?.url || url}`;
    if (publicAdminRoutes.has(key)) {
      return;
    }

    await adminAuthenticate(request, reply);
  });

  await registerContractRoutes(app, container);
  await registerSupportRoutes(app, container);
  await registerSignatureRoutes(app, container);
  await registerNoticeRoutes(app, container);
  await registerCentralActivityRoutes(app, container);
  await registerBugReportRoutes(app, container);
  await registerAdminAuthRoutes(app, container);
  await registerAdminNoticeRoutes(app, container);
  await registerAdminAnalyticsRoutes(app, container);
  await registerAdminTicketRoutes(app, container);
  await registerDebugOltCloudRoutes(app, container);
  await registerCentralNetworkStatusRoutes(app, container);
  await registerAdminNetworkIncidentRoutes(app, container);

  return app;
}
