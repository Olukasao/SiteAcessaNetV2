import type { OltCloudClient } from "../../integrations/oltcloud/oltCloudClient.js";
import type { NetworkIncidentRepository } from "../../repositories/networkIncidentRepository.js";
import { detectActivePonOutages, type PonOutageLogEntry } from "./ponOutageDetectionService.js";

export interface PonOutageSyncConfig {
  intervalSeconds: number;
}

export type PonOutageSyncLogEntry =
  | PonOutageLogEntry
  | { event: "pon_outage_sync_completed"; activeCount: number }
  | { event: "pon_outage_sync_failed"; reason: string };

export type PonOutageSyncLogger = (entry: PonOutageSyncLogEntry) => void;

export interface PonOutageSyncHandle {
  /** Forca um ciclo de sync fora do intervalo (ex.: debug/teste). Nunca roda dois ciclos em paralelo. */
  syncOnce: () => Promise<void>;
  stop: () => void;
}

/**
 * Sincronizacao periodica (regra 31/32 do pedido): alert/list -> pon_loss ->
 * equipment/list -> contratos -> persiste em network_incidents. A Central
 * nunca chama a OLT Cloud na hora da requisicao do cliente -- so le o
 * resultado deste sync (ver centralNetworkStatusRoutes.ts).
 *
 * Se alert/list falhar inteiro (OLT Cloud fora do ar), o ciclo so loga e
 * NAO chama resolveMissing -- nunca resolve incidentes ativos so porque uma
 * sincronizacao pontual falhou (regra 35, mesmo espirito do refreshIfStale
 * em regionalIncidentService.ts).
 */
export function startPonOutageSync(
  client: OltCloudClient,
  repository: NetworkIncidentRepository,
  config: PonOutageSyncConfig,
  logger: PonOutageSyncLogger = () => {}
): PonOutageSyncHandle {
  /**
   * Chamadas concorrentes (o auto-run abaixo + uma chamada manual, ou dois
   * timers que se cruzam) compartilham a MESMA promise em vez de uma
   * no-op/silenciosa -- nunca dois ciclos em paralelo, mas quem chama
   * syncOnce() sempre recebe o resultado do ciclo que esta de fato rodando.
   */
  let inFlight: Promise<void> | undefined;

  function syncOnce(): Promise<void> {
    if (inFlight) {
      return inFlight;
    }

    const run = (async () => {
      try {
        const rawAlerts = await client.listAlerts();
        const snapshots = await detectActivePonOutages(client, rawAlerts, logger);

        for (const snapshot of snapshots) {
          await repository.upsertActive({
            externalAlertId: snapshot.externalAlertId,
            oltId: snapshot.oltId || null,
            oltName: snapshot.oltName || null,
            slot: snapshot.slot || null,
            pon: snapshot.pon || null,
            ponId: snapshot.ponId || null,
            startedAt: snapshot.startedAt,
            affectedDevicesCount: snapshot.alertAffectedDevices,
            totalDevicesCount: snapshot.totalDevicesFromAlert,
            mappedContractsCount: snapshot.mappedContracts,
            unmappedEquipmentCount: snapshot.unmappedEquipment,
            mappingStatus: snapshot.mappingStatus,
            contracts: snapshot.contracts
          });
        }

        await repository.resolveMissing(snapshots.map((snapshot) => snapshot.externalAlertId));
        logger({ event: "pon_outage_sync_completed", activeCount: snapshots.length });
      } catch (error) {
        logger({ event: "pon_outage_sync_failed", reason: error instanceof Error ? error.message : "unknown" });
      } finally {
        inFlight = undefined;
      }
    })();

    inFlight = run;
    return run;
  }

  void syncOnce();
  const timer = setInterval(() => void syncOnce(), config.intervalSeconds * 1000);

  return { syncOnce, stop: () => clearInterval(timer) };
}
