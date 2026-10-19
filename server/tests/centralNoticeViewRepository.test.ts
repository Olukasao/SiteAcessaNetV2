import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/repositories/sqlite.js";
import { SqliteNoticeViewRepository } from "../src/repositories/centralNoticeViewRepository.js";

describe("SqliteNoticeViewRepository", () => {
  it("upsertView cria na primeira vez e incrementa nas seguintes", async () => {
    const repo = new SqliteNoticeViewRepository(createDatabase(":memory:"));

    await repo.upsertView("notice_1", "customer_1", 1);
    await repo.upsertView("notice_1", "customer_1", 1);
    await repo.upsertView("notice_1", "customer_1", 1);

    const stats = await repo.getStats("notice_1");
    expect(stats.totalViews).toBe(3);
    expect(stats.uniqueCustomers).toBe(1);
  });

  it("hasSeenVersion so e true se a versao vista for >= a versao atual (aviso editado reaparece)", async () => {
    const repo = new SqliteNoticeViewRepository(createDatabase(":memory:"));

    await repo.upsertView("notice_1", "customer_1", 1);

    expect(await repo.hasSeenVersion("notice_1", "customer_1", 1)).toBe(true);
    // Admin editou o aviso (version subiu pra 2) -- cliente ainda nao viu essa versao.
    expect(await repo.hasSeenVersion("notice_1", "customer_1", 2)).toBe(false);

    await repo.upsertView("notice_1", "customer_1", 2);
    expect(await repo.hasSeenVersion("notice_1", "customer_1", 2)).toBe(true);
  });

  it("visualizacoes de clientes diferentes contam separado", async () => {
    const repo = new SqliteNoticeViewRepository(createDatabase(":memory:"));

    await repo.upsertView("notice_1", "customer_1", 1);
    await repo.upsertView("notice_1", "customer_2", 1);

    const stats = await repo.getStats("notice_1");
    expect(stats.totalViews).toBe(2);
    expect(stats.uniqueCustomers).toBe(2);
  });
});
