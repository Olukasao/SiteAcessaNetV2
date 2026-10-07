import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/repositories/sqlite.js";
import { SqliteNetworkIncidentRepository, type UpsertNetworkIncidentInput } from "../src/repositories/networkIncidentRepository.js";

function baseInput(overrides: Partial<UpsertNetworkIncidentInput> = {}): UpsertNetworkIncidentInput {
  return {
    externalAlertId: "8821",
    oltId: "14",
    oltName: "OLT-14",
    slot: "1",
    pon: "0/1/3",
    ponId: "3",
    startedAt: "2026-09-30T07:42:00",
    affectedDevicesCount: 97,
    totalDevicesCount: 103,
    mappedContractsCount: 2,
    unmappedEquipmentCount: 0,
    mappingStatus: "OK",
    contracts: ["78411", "78420"],
    ...overrides
  };
}

describe("SqliteNetworkIncidentRepository", () => {
  it("cria um incidente novo e associa os contratos", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));

    const created = await repo.upsertActive(baseInput());

    expect(created.externalAlertId).toBe("8821");
    expect(created.status).toBe("ACTIVE");
    expect(created.mappedContractsCount).toBe(2);
    expect(await repo.listContractsForIncident(created.id)).toEqual(["78411", "78420"]);
  });

  it("mesmo external_alert_id atualiza em vez de duplicar (regra 17)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));

    const first = await repo.upsertActive(baseInput({ affectedDevicesCount: 97 }));
    const second = await repo.upsertActive(baseInput({ affectedDevicesCount: 80, contracts: ["78411"] }));

    expect(second.id).toBe(first.id);
    expect(second.affectedDevicesCount).toBe(80);
    expect(await repo.listContractsForIncident(second.id)).toEqual(["78411"]);

    const active = await repo.listActive();
    expect(active).toHaveLength(1);
  });

  it("mantem started_at original em atualizacoes (nao reinicia o relogio do incidente)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));

    await repo.upsertActive(baseInput({ startedAt: "2026-09-30T07:42:00" }));
    const updated = await repo.upsertActive(baseInput({ startedAt: "2026-09-30T08:00:00" }));

    expect(updated.startedAt).toBe("2026-09-30T07:42:00");
  });

  it("findActiveByContract encontra pelo contrato associado, sem chamar a OLT Cloud (so leitura local)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    await repo.upsertActive(baseInput());

    const found = await repo.findActiveByContract("78420");
    expect(found?.externalAlertId).toBe("8821");

    const notFound = await repo.findActiveByContract("99999");
    expect(notFound).toBeNull();
  });

  it("resolveMissing marca RESOLVED quem nao esta mais ativo e remove a associacao com contratos (regra 18)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    const incident = await repo.upsertActive(baseInput());

    await repo.resolveMissing([]);

    const active = await repo.listActive();
    expect(active).toHaveLength(0);
    expect(await repo.listContractsForIncident(incident.id)).toEqual([]);
    expect(await repo.findActiveByContract("78411")).toBeNull();

    const resolved = await repo.findById(incident.id);
    expect(resolved?.status).toBe("RESOLVED");
    expect(resolved?.endedAt).not.toBeNull();
  });

  it("resolveMissing nao toca em incidentes cujo external_alert_id ainda esta na lista ativa", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    await repo.upsertActive(baseInput());

    await repo.resolveMissing(["8821"]);

    const active = await repo.listActive();
    expect(active).toHaveLength(1);
    expect(active[0]?.status).toBe("ACTIVE");
  });

  it("dois contratos de clientes diferentes em PONs diferentes nunca se misturam (regra 38)", async () => {
    const repo = new SqliteNetworkIncidentRepository(createDatabase(":memory:"));
    await repo.upsertActive(baseInput({ externalAlertId: "1", pon: "0/1/3", contracts: ["100"] }));
    await repo.upsertActive(baseInput({ externalAlertId: "2", pon: "0/2/3", contracts: ["200"] }));

    expect((await repo.findActiveByContract("100"))?.externalAlertId).toBe("1");
    expect((await repo.findActiveByContract("200"))?.externalAlertId).toBe("2");
    expect(await repo.findActiveByContract("300")).toBeNull();
  });
});
