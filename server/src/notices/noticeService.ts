import { AppError } from "../errors.js";
import { randomId } from "../security/hash.js";
import type { AdminRole } from "../auth/adminPermissions.js";
import { requirePermission } from "../auth/adminPermissions.js";
import type { NoticeRepository, CreateNoticeInput, UpdateNoticeInput } from "../repositories/centralNoticeRepository.js";
import type { NoticeViewRepository, NoticeViewStats } from "../repositories/centralNoticeViewRepository.js";
import type { AdminAuditLogRepository } from "../repositories/adminAuditLogRepository.js";
import { matchesAudience } from "./noticeAudience.js";
import type { Notice, NoticeAudienceContext, PublicNotice } from "./types.js";

export interface NoticeActor {
  adminUserId: string;
  adminEmail: string;
  role: AdminRole;
  ipHash: string | null;
  userAgent: string | undefined;
}

export type CreateNoticeRequest = Omit<CreateNoticeInput, "id" | "createdBy">;

function snapshot(notice: Notice): Record<string, unknown> {
  return {
    title: notice.title,
    type: notice.type,
    display: notice.display,
    priority: notice.priority,
    frequency: notice.frequency,
    audienceType: notice.audienceType,
    startsAt: notice.startsAt?.toISOString() ?? null,
    endsAt: notice.endsAt?.toISOString() ?? null,
    active: notice.active
  };
}

function toPublicNotice(notice: Notice): PublicNotice {
  return {
    id: notice.id,
    title: notice.title,
    message: notice.message,
    imageUrl: notice.imageUrl,
    type: notice.type,
    display: notice.display,
    priority: notice.priority,
    dismissible: notice.dismissible,
    frequency: notice.frequency,
    version: notice.version
  };
}

/**
 * Regra de UX pedida explicitamente: modal com frequencia "always" vira
 * popup irritante em toda navegacao. Bloqueado na validacao, nao so
 * sugerido na UI.
 */
function assertDisplayFrequencyIsSane(input: { display: string; frequency: string }) {
  if (input.display === "modal" && input.frequency === "always") {
    throw new AppError(
      400,
      "MODAL_ALWAYS_NOT_ALLOWED",
      "Modal nao pode usar frequencia 'sempre' -- o cliente ficaria vendo popup em toda navegacao. Use 'uma vez por sessao' ou 'uma vez por cliente'."
    );
  }
}

export class NoticeService {
  constructor(
    private readonly notices: NoticeRepository,
    private readonly views: NoticeViewRepository,
    private readonly auditLog: AdminAuditLogRepository
  ) {}

  async listForAdmin(actor: NoticeActor): Promise<Array<Notice & { stats: NoticeViewStats }>> {
    requirePermission(actor.role, "avisos.read");
    const notices = await this.notices.list();
    return Promise.all(
      notices.map(async (notice) => ({ ...notice, stats: await this.views.getStats(notice.id) }))
    );
  }

  async getForAdmin(actor: NoticeActor, id: string): Promise<Notice & { stats: NoticeViewStats }> {
    requirePermission(actor.role, "avisos.read");
    const notice = await this.notices.findById(id, { includeDeleted: true });
    if (!notice) {
      throw new AppError(404, "NOTICE_NOT_FOUND", "Aviso nao encontrado.");
    }
    return { ...notice, stats: await this.views.getStats(id) };
  }

  async create(actor: NoticeActor, input: CreateNoticeRequest): Promise<Notice> {
    assertDisplayFrequencyIsSane(input);
    requirePermission(actor.role, input.active ? "avisos.publish" : "avisos.create");

    const notice = await this.notices.create({ ...input, id: randomId("notice"), createdBy: actor.adminUserId });

    await this.auditLog.record({
      adminUserId: actor.adminUserId,
      adminEmail: actor.adminEmail,
      action: "AVISO_CRIADO",
      noticeId: notice.id,
      ipHash: actor.ipHash,
      userAgent: actor.userAgent,
      afterSnapshot: snapshot(notice)
    });

    if (notice.active) {
      await this.auditLog.record({
        adminUserId: actor.adminUserId,
        adminEmail: actor.adminEmail,
        action: "AVISO_PUBLICADO",
        noticeId: notice.id,
        ipHash: actor.ipHash,
        userAgent: actor.userAgent,
        afterSnapshot: snapshot(notice)
      });
    }

    return notice;
  }

  async duplicate(actor: NoticeActor, id: string): Promise<Notice> {
    requirePermission(actor.role, "avisos.create");
    const original = await this.notices.findById(id, { includeDeleted: true });
    if (!original) {
      throw new AppError(404, "NOTICE_NOT_FOUND", "Aviso nao encontrado.");
    }

    const copy = await this.notices.create({
      id: randomId("notice"),
      title: `${original.title} (cópia)`,
      message: original.message,
      imageUrl: original.imageUrl,
      type: original.type,
      display: original.display,
      priority: original.priority,
      dismissible: original.dismissible,
      frequency: original.frequency,
      origin: "manual",
      audienceType: original.audienceType,
      audienceFilter: original.audienceFilter,
      startsAt: null,
      endsAt: null,
      active: false,
      createdBy: actor.adminUserId
    });

    await this.auditLog.record({
      adminUserId: actor.adminUserId,
      adminEmail: actor.adminEmail,
      action: "AVISO_CRIADO",
      noticeId: copy.id,
      ipHash: actor.ipHash,
      userAgent: actor.userAgent,
      afterSnapshot: { ...snapshot(copy), duplicatedFrom: original.id }
    });

    return copy;
  }

  async update(actor: NoticeActor, id: string, expectedVersion: number, patch: UpdateNoticeInput): Promise<Notice> {
    assertDisplayFrequencyIsSane(patch);
    requirePermission(actor.role, "avisos.update");

    const before = await this.notices.findById(id);
    if (!before) {
      throw new AppError(404, "NOTICE_NOT_FOUND", "Aviso nao encontrado.");
    }

    const applied = await this.notices.update(id, expectedVersion, patch);
    if (!applied) {
      throw new AppError(
        409,
        "NOTICE_VERSION_CONFLICT",
        "Este aviso foi alterado por outro usuário. Atualize a página antes de salvar novamente."
      );
    }

    const after = await this.notices.findById(id);
    if (!after) {
      throw new AppError(404, "NOTICE_NOT_FOUND", "Aviso nao encontrado.");
    }

    await this.auditLog.record({
      adminUserId: actor.adminUserId,
      adminEmail: actor.adminEmail,
      action: "AVISO_EDITADO",
      noticeId: id,
      ipHash: actor.ipHash,
      userAgent: actor.userAgent,
      beforeSnapshot: snapshot(before),
      afterSnapshot: snapshot(after)
    });

    return after;
  }

  async setActive(actor: NoticeActor, id: string, expectedVersion: number, active: boolean): Promise<Notice> {
    requirePermission(actor.role, "avisos.publish");

    const before = await this.notices.findById(id);
    if (!before) {
      throw new AppError(404, "NOTICE_NOT_FOUND", "Aviso nao encontrado.");
    }

    const applied = await this.notices.setActive(id, expectedVersion, active);
    if (!applied) {
      throw new AppError(
        409,
        "NOTICE_VERSION_CONFLICT",
        "Este aviso foi alterado por outro usuário. Atualize a página antes de salvar novamente."
      );
    }

    const after = await this.notices.findById(id);
    if (!after) {
      throw new AppError(404, "NOTICE_NOT_FOUND", "Aviso nao encontrado.");
    }

    await this.auditLog.record({
      adminUserId: actor.adminUserId,
      adminEmail: actor.adminEmail,
      action: active ? "AVISO_ATIVADO" : "AVISO_DESATIVADO",
      noticeId: id,
      ipHash: actor.ipHash,
      userAgent: actor.userAgent,
      beforeSnapshot: snapshot(before),
      afterSnapshot: snapshot(after)
    });

    return after;
  }

  async softDelete(actor: NoticeActor, id: string, expectedVersion: number): Promise<void> {
    requirePermission(actor.role, "avisos.delete");

    const before = await this.notices.findById(id);
    if (!before) {
      throw new AppError(404, "NOTICE_NOT_FOUND", "Aviso nao encontrado.");
    }

    const applied = await this.notices.softDelete(id, expectedVersion);
    if (!applied) {
      throw new AppError(
        409,
        "NOTICE_VERSION_CONFLICT",
        "Este aviso foi alterado por outro usuário. Atualize a página antes de salvar novamente."
      );
    }

    await this.auditLog.record({
      adminUserId: actor.adminUserId,
      adminEmail: actor.adminEmail,
      action: "AVISO_EXCLUIDO",
      noticeId: id,
      ipHash: actor.ipHash,
      userAgent: actor.userAgent,
      beforeSnapshot: snapshot(before)
    });
  }

  async getHistory(actor: NoticeActor, id: string) {
    requirePermission(actor.role, "avisos.read");
    return this.auditLog.listByNotice(id);
  }

  /** Cliente-facing: so os avisos ativos, dentro do periodo, cuja audiencia bate, ordenados por prioridade, sem repetir o que ja foi visto na versao atual. */
  async listActiveForCustomer(context: NoticeAudienceContext): Promise<PublicNotice[]> {
    const candidates = await this.notices.listActiveCandidates(new Date());
    const matching = candidates.filter((notice) => matchesAudience(notice, context));

    const visible: Notice[] = [];
    for (const notice of matching) {
      if (notice.frequency === "once_per_customer") {
        const seen = await this.views.hasSeenVersion(notice.id, context.customerId, notice.version);
        if (seen) continue;
      }
      visible.push(notice);
    }

    return visible.map(toPublicNotice);
  }

  /** Revalida a audiencia no servidor antes de gravar -- nunca confia que o cliente so chama isto para avisos que realmente eram dele. */
  async recordView(context: NoticeAudienceContext, noticeId: string): Promise<void> {
    const notice = await this.notices.findById(noticeId);
    if (!notice || !notice.active) {
      return;
    }

    if (!matchesAudience(notice, context)) {
      return;
    }

    await this.views.upsertView(notice.id, context.customerId, notice.version);
  }
}
