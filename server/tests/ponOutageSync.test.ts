import { describe, expect, it, vi } from "vitest";
import type { OltCloudClient } from "../src/integrations/oltcloud/oltCloudClient.js";
import { createDatabase } from "../src/repositories/sqlite.js";
import { SqliteNetworkIncidentRepository } from "../src/repositories/networkIncidentRepository.js";
import { startPonOutageSync } from "../src/services/networkIncidentDetection/ponOutageSyncService.js";

function rawAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: "8821",
    alert_type: "pon_loss",
    olt_id: "14",
    olt_name: "OLT-14",
    initial_date: "2026-09-30T07:42:00",
    confirm_date: null,
    end_date: null,
    ignored: false,
    description: "",
    total_devices_count: 103,
    active_devices_count: 97,
    pon_id: "3",
    pon: "0/1/3",
    slot_pon: "1",
    cto_id: "",
    cto_name: "",
    ...overrides
  };
}

function rawEquipment(overrides: Record<string, unknown> = {}) {
  return {
    status: "offline",
    external_client_contract_id: "78411",
    ...overrides
  };
}

function fakeClient(options: { alerts?: Record<string, unknown>[]; alertsError?: boolean; equipment?: Record<string, unknown>[] }): OltCloudClient {
  return {
    listAlerts: async () => {
      if (options.alertsError) throw new Error("oltcloud down");
      return options.alerts ?? [];
    },
    getClientDeviceAlert: async () => ({}),
    listEquipment: async () => options.equipment ?? [],
    getEquipmentRealtime: async () => ({})
  } as unknown as OltCloudClient;
}

describe("startPonOutageSync", () => {
  it("roda um ciclo imediatamente ao iniciar e persiste o incidente + contratos", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    const client = fakeClient({ alerts: [rawAlert()], equipment: [rawEquipment()] });

    const handle = startPonOutageSync(client, repo, { intervalSeconds: 3600 });
    await handle.syncOnce();
    handle.stop();

    const active = await repo.listActive();
    expect(active).toHaveLength(1);
    expect(active[0]?.oltId).toBe("14");
    expect(await repo.findActiveByContract("78411")).not.toBeNull();
  });

  it("resolve o incidente quando o alerta deixa de vir ativo em alert/list (regra 18)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    const client = fakeClient({ alerts: [rawAlert()], equipment: [rawEquipment()] });

    const handle = startPonOutageSync(client, repo, { intervalSeconds: 3600 });
    await handle.syncOnce();
    expect(await repo.listActive()).toHaveLength(1);

    client.listAlerts = async () => [rawAlert({ end_date: "2026-09-30T08:20:00" })];
    await handle.syncOnce();
    handle.stop();

    expect(await repo.listActive()).toHaveLength(0);
    expect(await repo.findActiveByContract("78411")).toBeNull();
  });

  it("se alert/list falhar inteiro, NAO resolve incidentes ja ativos (regra 35)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    const client = fakeClient({ alerts: [rawAlert()], equipment: [rawEquipment()] });

    const handle = startPonOutageSync(client, repo, { intervalSeconds: 3600 });
    await handle.syncOnce();
    expect(await repo.listActive()).toHaveLength(1);

    client.listAlerts = async () => {
      throw new Error("oltcloud fora do ar");
    };
    await handle.syncOnce();
    handle.stop();

    expect(await repo.listActive()).toHaveLength(1);
  });

  it("nunca roda dois ciclos em paralelo (reentrancia)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    let callCount = 0;
    const client = fakeClient({ alerts: [rawAlert()], equipment: [rawEquipment()] });
    const originalListAlerts = client.listAlerts.bind(client);
    client.listAlerts = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return originalListAlerts();
    };

    const handle = startPonOutageSync(client, repo, { intervalSeconds: 3600 });
    await Promise.all([handle.syncOnce(), handle.syncOnce()]);
    handle.stop();

    expect(callCount).toBeLessThanOrEqual(2);
  });

  it("nunca loga a lista de contratos nem CPF -- so contagens (regra 34)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    const client = fakeClient({ alerts: [rawAlert()], equipment: [rawEquipment(), rawEquipment({ external_client_contract_id: "78420" })] });
    const log = vi.fn();

    const handle = startPonOutageSync(client, repo, { intervalSeconds: 3600 }, log);
    await handle.syncOnce();
    handle.stop();

    const serialized = JSON.stringify(log.mock.calls);
    expect(serialized).not.toContain("78411");
    expect(serialized).not.toContain("78420");
  });
});
