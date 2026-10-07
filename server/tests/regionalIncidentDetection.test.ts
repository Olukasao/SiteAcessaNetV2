import { describe, expect, it } from "vitest";
import type { OltCloudClient } from "../src/integrations/oltcloud/oltCloudClient.js";
import {
  classifyAlertClusters,
  classifyProximityCluster,
  confidenceFromCount
} from "../src/services/networkIncidentDetection/regionalIncidentClassifier.js";
import { normalizeAlert, isActiveNetworkIncident } from "../src/integrations/oltcloud/incidentClassifier.js";
import { RegionalIncidentRepository } from "../src/services/networkIncidentDetection/regionalIncidentRepository.js";
import { RegionalIncidentService, type RegionalIncidentServiceConfig } from "../src/services/networkIncidentDetection/regionalIncidentService.js";

const baseConfig: RegionalIncidentServiceConfig = {
  minClients: 3,
  windowMinutes: 10,
  radiusMeters: 800,
  recoveryWindowMinutes: 5,
  refreshTtlMs: 0,
  equipmentProbeTtlMs: 0
};

function rawAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    alert_type: "mystery_type",
    olt_id: "10",
    olt_name: "OLT-Iracema",
    initial_date: "2026-09-30T10:32:00",
    confirm_date: null,
    end_date: null,
    ignored: false,
    description: "",
    total_devices_count: 1,
    active_devices_count: 1,
    pon_id: "7",
    pon: "0/2/7",
    slot_pon: "2",
    cto_id: "041",
    cto_name: "041",
    ...overrides
  };
}

function fakeClient(options: {
  alerts?: Record<string, unknown>[];
  alertsError?: boolean;
  topology?: Record<string, unknown>;
  equipmentOffline?: number;
}): OltCloudClient {
  return {
    listAlerts: async () => {
      if (options.alertsError) throw new Error("oltcloud down");
      return options.alerts ?? [];
    },
    getClientDeviceAlert: async () => options.topology ?? {},
    listEquipment: async () => Array.from({ length: options.equipmentOffline ?? 0 }, (_, i) => ({ id: String(i) })),
    getEquipmentRealtime: async () => ({})
  } as unknown as OltCloudClient;
}

describe("RegionalIncidentService.getRegionalIncidentForClient", () => {
  it("Caso 1: 1 cliente offline (sem alerta oficial, so 1 equipamento offline na PON) -- sem incidente regional", async () => {
    const client = fakeClient({ alerts: [], topology: { olt: "OLT-Iracema", pon: "0/2/7" }, equipmentOffline: 1 });
    const service = new RegionalIncidentService(client, baseConfig);

    const result = await service.getRegionalIncidentForClient("1001");

    expect(result).toEqual({ affected: false, status: "normal" });
  });

  it("Caso 2: 3 clientes da mesma PON offline (sem alerta oficial ainda) -- confidence high via correlacao equipment/list", async () => {
    const client = fakeClient({ alerts: [], topology: { olt: "OLT-Iracema", pon: "0/2/7" }, equipmentOffline: 3 });
    const service = new RegionalIncidentService(client, baseConfig);

    const result = await service.getRegionalIncidentForClient("1002");

    expect(result.affected).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("Caso 3: OLT Cloud informa pon_loss -- confidence confirmed (classificacao oficial tem prioridade)", async () => {
    const client = fakeClient({
      alerts: [rawAlert({ alert_type: "pon_loss", active_devices_count: 40 })],
      topology: { olt: "OLT-Iracema", pon: "0/2/7", cto: "041" }
    });
    const service = new RegionalIncidentService(client, baseConfig);

    const result = await service.getRegionalIncidentForClient("1003");

    expect(result.affected).toBe(true);
    expect(result.confidence).toBe("confirmed");
  });

  it("Caso 4: 3 clientes do mesmo bairro mas OLT/PON diferentes -- nao assume incidente regional (bairro nao entra na decisao)", async () => {
    const clientA = fakeClient({ alerts: [], topology: { olt: "OLT-A", pon: "0/1/1" }, equipmentOffline: 1 });
    const clientB = fakeClient({ alerts: [], topology: { olt: "OLT-B", pon: "0/2/2" }, equipmentOffline: 1 });
    const clientC = fakeClient({ alerts: [], topology: { olt: "OLT-C", pon: "0/3/3" }, equipmentOffline: 1 });

    const resultA = await new RegionalIncidentService(clientA, baseConfig).getRegionalIncidentForClient("2001");
    const resultB = await new RegionalIncidentService(clientB, baseConfig).getRegionalIncidentForClient("2002");
    const resultC = await new RegionalIncidentService(clientC, baseConfig).getRegionalIncidentForClient("2003");

    expect(resultA.affected).toBe(false);
    expect(resultB.affected).toBe(false);
    expect(resultC.affected).toBe(false);
  });

  it("Caso 6: OLT Cloud indisponivel -- status unknown (nunca reportado como 'normal')", async () => {
    const client = fakeClient({ alertsError: true, topology: { olt: "OLT-Iracema", pon: "0/2/7" } });
    const service = new RegionalIncidentService(client, baseConfig);

    const result = await service.getRegionalIncidentForClient("1006");

    expect(result).toEqual({ affected: false, status: "unknown" });
  });

  it("Caso 8: alerta ignorado pela OLT Cloud -- nao entra na correlacao mesmo com topologia batendo", async () => {
    const client = fakeClient({
      alerts: [rawAlert({ alert_type: "cto_loss", ignored: true, active_devices_count: 16 })],
      topology: { olt: "OLT-Iracema", pon: "0/2/7", cto: "041" }
    });
    const service = new RegionalIncidentService(client, baseConfig);

    const result = await service.getRegionalIncidentForClient("1008");

    expect(result.affected).toBe(false);
  });

  it("Caso 9: alerta com end_date preenchido -- nao e incidente ativo", async () => {
    const client = fakeClient({
      alerts: [rawAlert({ alert_type: "cto_loss", end_date: "2026-09-30T09:00:00", active_devices_count: 16 })],
      topology: { olt: "OLT-Iracema", pon: "0/2/7", cto: "041" }
    });
    const service = new RegionalIncidentService(client, baseConfig);

    const result = await service.getRegionalIncidentForClient("1009");

    expect(result.affected).toBe(false);
  });
});

describe("classifyAlertClusters / confidenceFromCount (motor de evidencias puro)", () => {
  it("alert_type conhecido -> confirmed independente da contagem", () => {
    const alerts = [rawAlert({ alert_type: "no_power", active_devices_count: 1 })].map(normalizeAlert).filter(isActiveNetworkIncident);
    const clusters = classifyAlertClusters(alerts, baseConfig);
    expect(clusters[0]?.confidence).toBe("confirmed");
  });

  it("confidenceFromCount: 1 -> low, 2 -> medium, 3+ -> high (minClients=3)", () => {
    expect(confidenceFromCount(1, 3)).toBe("low");
    expect(confidenceFromCount(2, 3)).toBe("medium");
    expect(confidenceFromCount(3, 3)).toBe("high");
    expect(confidenceFromCount(10, 3)).toBe("high");
  });
});

describe("classifyProximityCluster (Caso 5 -- funcao pura pronta, sem fonte real de lat/long ainda)", () => {
  it("5 clientes geograficamente proximos na mesma janela de tempo -> cluster de tamanho 5 -> high", () => {
    const base = { latitude: -23.4611, longitude: -46.8239 };
    const points = Array.from({ length: 5 }, (_, i) => ({
      contractId: `contract_${i}`,
      occurredAt: new Date(Date.parse("2026-09-30T10:32:00") + i * 60_000).toISOString(),
      latitude: base.latitude + i * 0.0005,
      longitude: base.longitude + i * 0.0005
    }));

    const maxCluster = classifyProximityCluster(points, baseConfig);

    expect(maxCluster).toBe(5);
    expect(confidenceFromCount(maxCluster, baseConfig.minClients)).toBe("high");
  });

  it("pontos fora do raio nao entram no mesmo cluster", () => {
    const points = [
      { contractId: "a", occurredAt: "2026-09-30T10:32:00", latitude: -23.4611, longitude: -46.8239 },
      { contractId: "b", occurredAt: "2026-09-30T10:32:00", latitude: -23.6, longitude: -46.9 }
    ];

    const maxCluster = classifyProximityCluster(points, baseConfig);
    expect(maxCluster).toBe(1);
  });
});

describe("Cenario mock 'Jardim Luciana' (secao 17 do pedido)", () => {
  const contracts = [
    { id: "1001", cto: "041", offlineAt: "2026-09-30T10:32:00" },
    { id: "1002", cto: "041", offlineAt: "2026-09-30T10:33:00" },
    { id: "1003", cto: "042", offlineAt: "2026-09-30T10:34:00" },
    { id: "1004", cto: "042", offlineAt: "2026-09-30T10:35:00" }
  ];

  it("sem alerta oficial ainda: 4 equipamentos offline na mesma PON -> confidence high, scope pon", async () => {
    for (const contract of contracts) {
      const client = fakeClient({
        alerts: [],
        topology: { olt: "OLT-Iracema", pon: "0/2/7", cto: contract.cto },
        equipmentOffline: 4
      });
      const service = new RegionalIncidentService(client, baseConfig);
      const result = await service.getRegionalIncidentForClient(contract.id);

      expect(result.affected).toBe(true);
      expect(result.confidence).toBe("high");
    }
  });

  it("depois a OLT Cloud confirma pon_loss: confidence sobe pra confirmed", async () => {
    const alerts = [
      rawAlert({
        id: "500",
        alert_type: "pon_loss",
        olt_id: "10",
        olt_name: "OLT-Iracema",
        pon_id: "7",
        pon: "0/2/7",
        cto_id: "",
        cto_name: "",
        active_devices_count: 18,
        initial_date: "2026-09-30T10:32:00"
      })
    ];

    for (const contract of contracts) {
      const client = fakeClient({ alerts, topology: { olt: "OLT-Iracema", pon: "0/2/7", cto: contract.cto } });
      const service = new RegionalIncidentService(client, baseConfig);
      const result = await service.getRegionalIncidentForClient(contract.id);

      expect(result.affected).toBe(true);
      expect(result.confidence).toBe("confirmed");
    }
  });
});

describe("RegionalIncidentRepository (Caso 7 -- ciclo confirmed -> recovering -> resolved)", () => {
  it("perde evidencia -> vira recovering apos a folga, depois resolved apos a janela de recuperacao", () => {
    const repo = new RegionalIncidentRepository(5, 1_000);
    const t0 = new Date("2026-09-30T10:00:00Z");

    repo.upsertCluster(
      {
        scope: "pon",
        olt: "OLT-Iracema",
        pon: "0/2/7",
        ctos: ["041"],
        confidence: "high",
        source: "correlation",
        startedAt: t0.toISOString(),
        lastEvidenceAt: t0.toISOString(),
        affectedClientsEstimate: 4
      },
      t0
    );

    const confirmed = repo.findActiveForTopology({ pon: "0/2/7" });
    expect(confirmed?.status).toBe("confirmed");

    repo.sweepStale(new Date(t0.getTime() + 2_000));
    const recovering = repo.findActiveForTopology({ pon: "0/2/7" });
    expect(recovering?.status).toBe("recovering");

    repo.sweepStale(new Date(t0.getTime() + 2_000 + 5 * 60_000 + 1_000));
    const resolved = repo.findActiveForTopology({ pon: "0/2/7" });
    expect(resolved).toBeUndefined();
    expect(repo.listAll()[0]?.status).toBe("resolved");
  });

  it("nova evidencia antes da janela expirar traz de volta pra confirmed", () => {
    const repo = new RegionalIncidentRepository(5, 1_000);
    const t0 = new Date("2026-09-30T10:00:00Z");

    repo.upsertCluster(
      { scope: "pon", pon: "0/2/7", ctos: [], confidence: "high", source: "correlation", startedAt: t0.toISOString(), lastEvidenceAt: t0.toISOString() },
      t0
    );

    repo.sweepStale(new Date(t0.getTime() + 2_000));
    expect(repo.findActiveForTopology({ pon: "0/2/7" })?.status).toBe("recovering");

    const t1 = new Date(t0.getTime() + 3_000);
    repo.upsertCluster(
      { scope: "pon", pon: "0/2/7", ctos: [], confidence: "high", source: "correlation", startedAt: t0.toISOString(), lastEvidenceAt: t1.toISOString() },
      t1
    );

    expect(repo.findActiveForTopology({ pon: "0/2/7" })?.status).toBe("confirmed");
  });
});
