import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/repositories/sqlite.js";
import { SqliteNoticeRepository } from "../src/repositories/centralNoticeRepository.js";
import type { CreateNoticeInput } from "../src/repositories/centralNoticeRepository.js";

function baseInput(overrides: Partial<CreateNoticeInput> = {}): CreateNoticeInput {
  return {
    id: overrides.id ?? "notice_test",
    title: "Manutencao programada",
    imageUrl: null,
    message: "Manutencao hoje das 02h as 04h.",
    type: "manutencao",
    display: "banner",
    priority: "normal",
    dismissible: true,
    frequency: "always",
    origin: "manual",
    audienceType: "all",
    audienceFilter: null,
    startsAt: null,
    endsAt: null,
    active: true,
    createdBy: "admin_1",
    ...overrides
  };
}

describe("SqliteNoticeRepository", () => {
  it("cria e busca por id", async () => {
    const repo = new SqliteNoticeRepository(createDatabase(":memory:"));
    const created = await repo.create(baseInput());

    expect(created.version).toBe(1);
    const found = await repo.findById(created.id);
    expect(found?.title).toBe("Manutencao programada");
  });

  it("update com version correta aplica e incrementa version; version desatualizada e rejeitada (409 no service)", async () => {
    const repo = new SqliteNoticeRepository(createDatabase(":memory:"));
    const created = await repo.create(baseInput());

    const patch = {
      title: "Titulo editado",
      message: created.message,
      imageUrl: created.imageUrl,
      type: created.type,
      display: created.display,
      priority: created.priority,
      dismissible: created.dismissible,
      frequency: created.frequency,
      origin: created.origin,
      audienceType: created.audienceType,
      audienceFilter: created.audienceFilter,
      startsAt: created.startsAt,
      endsAt: created.endsAt,
      active: created.active
    };

    const appliedFirst = await repo.update(created.id, 1, patch);
    expect(appliedFirst).toBe(true);

    const afterFirst = await repo.findById(created.id);
    expect(afterFirst?.version).toBe(2);
    expect(afterFirst?.title).toBe("Titulo editado");

    // Segunda tentativa usando a version antiga (1) -- simula dois admins editando ao mesmo tempo.
    const appliedStale = await repo.update(created.id, 1, patch);
    expect(appliedStale).toBe(false);
  });

  it("soft delete com version desatualizada tambem e rejeitado", async () => {
    const repo = new SqliteNoticeRepository(createDatabase(":memory:"));
    const created = await repo.create(baseInput());

    await repo.setActive(created.id, 1, false); // version vira 2

    const deletedWithStaleVersion = await repo.softDelete(created.id, 1);
    expect(deletedWithStaleVersion).toBe(false);

    const deletedWithCurrentVersion = await repo.softDelete(created.id, 2);
    expect(deletedWithCurrentVersion).toBe(true);

    expect(await repo.findById(created.id)).toBeNull();
  });

  it("listActiveCandidates respeita janela de data e ordena por prioridade (critica primeiro)", async () => {
    const repo = new SqliteNoticeRepository(createDatabase(":memory:"));
    const now = new Date();
    const past = new Date(now.getTime() - 60_000);
    const future = new Date(now.getTime() + 60_000);

    await repo.create(baseInput({ id: "n_normal", priority: "normal" }));
    await repo.create(baseInput({ id: "n_critica", priority: "critica" }));
    await repo.create(baseInput({ id: "n_futuro", priority: "critica", startsAt: future }));
    await repo.create(baseInput({ id: "n_expirado", priority: "critica", endsAt: past }));
    await repo.create(baseInput({ id: "n_inativo", priority: "critica", active: false }));

    const candidates = await repo.listActiveCandidates(now);
    const ids = candidates.map((notice) => notice.id);

    expect(ids).toEqual(["n_critica", "n_normal"]);
  });
});
