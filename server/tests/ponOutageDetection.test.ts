import { describe, expect, it } from "vitest";
import type { OltCloudClient } from "../src/integrations/oltcloud/oltCloudClient.js";
import { detectActivePonOutages, type PonOutageLogEntry } from "../src/services/networkIncidentDetection/ponOutageDetectionService.js";
import { getPonAffectedContracts, buildPonRosterSummary } from "../src/integrations/oltcloud/ponRosterService.js";
import { normalizeEquipment } from "../src/integrations/oltcloud/oltEquipmentNormalizer.js";

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
    serial_number: "ZTEGC1234567",
    status: "offline",
    last_status_update: "2026-09-30T07:40:00",
    last_disconnection: "2026-09-30T07:40:00",
    external_client_contract_id: "78411",
    olt_id: "14",
    slot: "1",
    pon: "0/1/3",
    pon_id: "3",
    ...overrides
  };
}

function fakeClient(options: { equipment?: Record<string, unknown>[]; equipmentError?: boolean }): OltCloudClient {
  return {
    listAlerts: async () => [],
    getClientDeviceAlert: async () => ({}),
    listEquipment: async () => {
      if (options.equipmentError) throw new Error("equipment/list indisponivel");
      return options.equipment ?? [];
    },
    getEquipmentRealtime: async () => ({})
  } as unknown as OltCloudClient;
}

describe("detectActivePonOutages", () => {
  it("pon_loss ativo cria um snapshot PON_OUTAGE (mappingStatus OK)", async () => {
    const equipment = Array.from({ length: 103 }, (_, i) =>
      rawEquipment({
        serial_number: `SER${i}`,
        status: i < 97 ? "offline" : "online",
        external_client_contract_id: String(78000 + i)
      })
    );
    const client = fakeClient({ equipment });

    const snapshots = await detectActivePonOutages(client, [rawAlert()]);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      externalAlertId: "8821",
      oltId: "14",
      slot: "1",
      mappingStatus: "OK",
      equipmentTotal: 103,
      equipmentOffline: 97,
      mappedContracts: 97,
      unmappedEquipment: 0
    });
  });

  it("pon_loss ignorado (ignored=true) nao gera incidente", async () => {
    const client = fakeClient({ equipment: [] });
    const snapshots = await detectActivePonOutages(client, [rawAlert({ ignored: true })]);
    expect(snapshots).toHaveLength(0);
  });

  it("pon_loss com end_date preenchido (ja encerrado) nao gera incidente ativo", async () => {
    const client = fakeClient({ equipment: [] });
    const snapshots = await detectActivePonOutages(client, [rawAlert({ end_date: "2026-09-30T08:20:00" })]);
    expect(snapshots).toHaveLength(0);
  });

  it("no_power NAO e tratado como PON_OUTAGE (regra 28 -- classificacao separada)", async () => {
    const client = fakeClient({ equipment: [] });
    const snapshots = await detectActivePonOutages(client, [rawAlert({ alert_type: "no_power" })]);
    expect(snapshots).toHaveLength(0);
  });

  it("equipamentos sem external_client_contract_id nao quebram -- contam como unmapped", async () => {
    const equipment = [
      rawEquipment({ external_client_contract_id: "78411" }),
      rawEquipment({ external_client_contract_id: null }),
      rawEquipment({ external_client_contract_id: "" })
    ];
    const client = fakeClient({ equipment });

    const snapshots = await detectActivePonOutages(client, [rawAlert({ active_devices_count: 3 })]);

    expect(snapshots[0]?.mappedContracts).toBe(1);
    expect(snapshots[0]?.unmappedEquipment).toBe(2);
    expect(snapshots[0]?.contracts).toEqual(["78411"]);
  });

  it("contratos duplicados na mesma PON sao deduplicados", async () => {
    const equipment = [
      rawEquipment({ external_client_contract_id: "78411" }),
      rawEquipment({ external_client_contract_id: "78411" }),
      rawEquipment({ external_client_contract_id: "78420" })
    ];
    const client = fakeClient({ equipment });

    const snapshots = await detectActivePonOutages(client, [rawAlert({ active_devices_count: 3 })]);

    expect(snapshots[0]?.mappedContracts).toBe(2);
    expect(snapshots[0]?.contracts.sort()).toEqual(["78411", "78420"]);
  });

  it("duas PONs diferentes na mesma OLT nao se misturam (chave composta OLT+SLOT+PON)", async () => {
    const client = fakeClient({ equipment: [rawEquipment({ external_client_contract_id: "78411" })] });

    const alerts = [
      rawAlert({ id: "1", slot_pon: "1", pon_id: "3", pon: "0/1/3" }),
      rawAlert({ id: "2", slot_pon: "2", pon_id: "3", pon: "0/2/3" })
    ];

    const snapshots = await detectActivePonOutages(client, alerts);

    expect(snapshots).toHaveLength(2);
    expect(new Set(snapshots.map((s) => s.slot))).toEqual(new Set(["1", "2"]));
  });

  it("alert reportou 97 mas equipment/list so achou 94 offline -- registra divergencia sem descartar o incidente (regra 10/36)", async () => {
    const equipment = Array.from({ length: 94 }, (_, i) => rawEquipment({ serial_number: `SER${i}`, external_client_contract_id: String(78000 + i) }));
    const client = fakeClient({ equipment });

    const snapshots = await detectActivePonOutages(client, [rawAlert({ active_devices_count: 97 })]);

    expect(snapshots[0]?.mappingStatus).toBe("OK");
    expect(snapshots[0]?.countDivergence).toEqual({ alertReportedAffected: 97, equipmentOfflineFound: 94 });
  });

  it("equipment/list falhando NAO descarta o pon_loss -- mappingStatus FAILED, incidente continua existindo (regra 35)", async () => {
    const client = fakeClient({ equipmentError: true });
    const log: PonOutageLogEntry[] = [];

    const snapshots = await detectActivePonOutages(client, [rawAlert()], (entry) => log.push(entry));

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.mappingStatus).toBe("FAILED");
    expect(snapshots[0]?.contracts).toEqual([]);
    expect(log.some((entry) => entry.event === "pon_roster_mapping_failed")).toBe(true);
  });
});

describe("ponRosterService (funcoes puras)", () => {
  it("getPonAffectedContracts descarta null/undefined/vazio e deduplica", () => {
    const equipment = [
      normalizeEquipment(rawEquipment({ external_client_contract_id: "1" })),
      normalizeEquipment(rawEquipment({ external_client_contract_id: "1" })),
      normalizeEquipment(rawEquipment({ external_client_contract_id: null })),
      normalizeEquipment(rawEquipment({ external_client_contract_id: "" })),
      normalizeEquipment(rawEquipment({ external_client_contract_id: "2" }))
    ];

    expect(getPonAffectedContracts(equipment).sort()).toEqual(["1", "2"]);
  });

  it("buildPonRosterSummary so conta contrato de equipamento offline -- online nao entra em affectedContracts (regra 9)", () => {
    const equipment = [
      normalizeEquipment(rawEquipment({ status: "offline", external_client_contract_id: "78411" })),
      normalizeEquipment(rawEquipment({ status: "online", external_client_contract_id: "78420" }))
    ];

    const summary = buildPonRosterSummary(equipment);

    expect(summary.totalCount).toBe(2);
    expect(summary.offlineCount).toBe(1);
    expect(summary.contracts).toEqual(["78411"]);
  });
});
