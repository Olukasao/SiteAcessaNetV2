import { buildApp } from "./app.js";
import { createContainer } from "./container.js";
import { startPonOutageSync, type PonOutageSyncLogEntry } from "./services/networkIncidentDetection/ponOutageSyncService.js";

async function start() {
  const container = createContainer();
  // Garante que o schema do banco exista antes de aceitar qualquer request
  // (so tem efeito real com DB_DRIVER=mysql -- ver dbReady em container.ts).
  await container.dbReady;
  const app = await buildApp(container);

  /**
   * Sync periodico de queda massiva de PON (regra 31/32 do pedido) -- so
   * roda quando OLT Cloud esta configurado. Formato de log pedido na regra
   * 34; nunca inclui CPF ou a lista de contratos (so contagens).
   */
  if (container.oltCloud) {
    startPonOutageSync(
      container.oltCloud.client,
      container.networkIncidents,
      container.config.ponOutageSync,
      (entry: PonOutageSyncLogEntry) => app.log.info({ tag: "OLT-INCIDENT", ...entry }, "[OLT-INCIDENT]")
    );
  }

  // Erros dentro de uma rota já passam pelo errorHandler do Fastify (ver
  // errors.ts) e nunca chegam aqui. Isto so cobre o que escapa do ciclo de
  // requisicao (ex.: uma promise solta em um setInterval/callback). Uma
  // rejeicao nao tratada so vira log -- nao derruba o processo por si so,
  // então nao pode virar reinicio "do nada" no PM2. Uma excecao sincrona nao
  // capturada deixa o processo em estado indefinido (regra do proprio
  // Node.js): logamos e saimos de propósito, para o PM2 reiniciar limpo em
  // vez do processo continuar servindo requisicoes num estado quebrado.
  process.on("unhandledRejection", (reason) => {
    app.log.error({ err: reason }, "Unhandled promise rejection");
  });

  process.on("uncaughtException", (error) => {
    app.log.error({ err: error }, "Uncaught exception -- encerrando para o PM2 reiniciar");
    process.exit(1);
  });

  try {
    await app.listen({ port: container.config.port, host: "0.0.0.0" });
    app.log.info(`site-acessanet-server ouvindo na porta ${container.config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
