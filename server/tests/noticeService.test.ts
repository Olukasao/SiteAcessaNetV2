import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/repositories/sqlite.js";
import { SqliteNoticeRepository } from "../src/repositories/centralNoticeRepository.js";
import { SqliteNoticeViewRepository } from "../src/repositories/centralNoticeViewRepository.js";
import { SqliteAdminAuditLogRepository } from "../src/repositories/adminAuditLogRepository.js";
import { NoticeService, type NoticeActor, type CreateNoticeRequest } from "../src/notices/noticeService.js";
import { AppError } from "../src/errors.js";

function buildService() {
  const db = createDatabase(":memory:");
  return new NoticeService(
    new SqliteNoticeRepository(db),
    new SqliteNoticeViewRepository(db),
    new SqliteAdminAuditLogRepository(db)
  );
}

function actor(role: NoticeActor["role"] = "admin"): NoticeActor {
  return { adminUserId: "admin_1", adminEmail: "admin@acessanet.com", role, ipHash: null, userAgent: undefined };
}

function baseCreateInput(overrides: Partial<CreateNoticeRequest> = {}): CreateNoticeRequest {
  return {
    title: "Aviso de teste",
    imageUrl: null,
    message: "Mensagem de teste",
    type: "informativo",
    display: "card",
    priority: "normal",
    dismissible: true,
    frequency: "always",
    origin: "manual",
    audienceType: "all",
    audienceFilter: null,
    startsAt: null,
    endsAt: null,
    active: true,
    ...overrides
  };
}

describe("NoticeService", () => {
  it("rejeita modal com frequencia 'always' (evita popup em toda navegacao)", async () => {
    const service = buildService();
    await expect(
      service.create(actor(), baseCreateInput({ display: "modal", frequency: "always" }))
    ).rejects.toMatchObject({ code: "MODAL_ALWAYS_NOT_ALLOWED" });
  });

  it("viewer nao pode criar aviso (403)", async () => {
    const service = buildService();
    await expect(service.create(actor("viewer"), baseCreateInput())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("editor nao pode excluir aviso (403), mas admin pode", async () => {
    const service = buildService();
    const notice = await service.create(actor("editor"), baseCreateInput());

    await expect(service.softDelete(actor("editor"), notice.id, notice.version)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.softDelete(actor("admin"), notice.id, notice.version)).resolves.toBeUndefined();
  });

  it("update com expectedVersion desatualizada devolve 409 (conflito de concorrencia)", async () => {
    const service = buildService();
    const notice = await service.create(actor(), baseCreateInput());

    await service.update(actor(), notice.id, notice.version, { ...baseCreateInput(), title: "Editado por admin A" });

    await expect(
      service.update(actor(), notice.id, notice.version, { ...baseCreateInput(), title: "Editado por admin B" })
    ).rejects.toMatchObject({ statusCode: 409, code: "NOTICE_VERSION_CONFLICT" });
  });

  it("listActiveForCustomer + recordView: once_per_customer some da lista so depois de visto, e reaparece se o aviso for editado", async () => {
    const service = buildService();
    const notice = await service.create(
      actor(),
      baseCreateInput({ display: "card", frequency: "once_per_customer" })
    );

    const context = { customerId: "customer_1", contract: undefined };

    const beforeView = await service.listActiveForCustomer(context);
    expect(beforeView.map((item) => item.id)).toContain(notice.id);

    await service.recordView(context, notice.id);

    const afterView = await service.listActiveForCustomer(context);
    expect(afterView.map((item) => item.id)).not.toContain(notice.id);

    // Admin edita o aviso (version sobe) -- deve reaparecer uma vez para quem ja viu a versao anterior.
    await service.update(actor(), notice.id, notice.version, { ...baseCreateInput(), title: "Titulo atualizado" });

    const afterEdit = await service.listActiveForCustomer(context);
    expect(afterEdit.map((item) => item.id)).toContain(notice.id);
  });

  it("recordView revalida audiencia no servidor -- nao grava visualizacao pra aviso de outro contrato", async () => {
    const service = buildService();
    const notice = await service.create(
      actor(),
      baseCreateInput({ audienceType: "contract", audienceFilter: { type: "contract", contractIds: ["contract_A"] } })
    );

    const outsiderContext = {
      customerId: "customer_2",
      contract: { id: "contract_B", city: "X", state: "SP", planName: "Plano", status: "ACTIVE" }
    };

    await service.recordView(outsiderContext, notice.id);

    const stats = await service.getForAdmin(actor(), notice.id);
    expect(stats.stats.totalViews).toBe(0);
  });
});
