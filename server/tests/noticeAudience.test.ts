import { describe, expect, it } from "vitest";
import { matchesAudience } from "../src/notices/noticeAudience.js";
import type { Notice } from "../src/notices/types.js";

function baseNotice(overrides: Partial<Notice> = {}): Notice {
  return {
    id: "notice_1",
    title: "Titulo",
    message: "Mensagem",
    imageUrl: null,
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
    deletedAt: null,
    version: 1,
    createdBy: "admin_1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

const contract = { id: "contract_1", city: "Franco da Rocha", state: "SP", planName: "800 Mega", status: "ACTIVE" };

describe("matchesAudience", () => {
  it("aviso 'all' vale pra qualquer cliente, com ou sem contrato", () => {
    const notice = baseNotice();
    expect(matchesAudience(notice, { customerId: "c1", contract: undefined })).toBe(true);
    expect(matchesAudience(notice, { customerId: "c1", contract })).toBe(true);
  });

  it("audience 'contract' so bate com o id exato", () => {
    const notice = baseNotice({ audienceType: "contract", audienceFilter: { type: "contract", contractIds: ["contract_1"] } });
    expect(matchesAudience(notice, { customerId: "c1", contract })).toBe(true);
    expect(matchesAudience(notice, { customerId: "c1", contract: { ...contract, id: "contract_2" } })).toBe(false);
    expect(matchesAudience(notice, { customerId: "c1", contract: undefined })).toBe(false);
  });

  it("audience 'customer' ignora contrato e olha so customerId", () => {
    const notice = baseNotice({ audienceType: "customer", audienceFilter: { type: "customer", customerIds: ["c1"] } });
    expect(matchesAudience(notice, { customerId: "c1", contract: undefined })).toBe(true);
    expect(matchesAudience(notice, { customerId: "c2", contract: undefined })).toBe(false);
  });

  it("audience 'plan'/'city'/'state'/'contract_status' exigem contrato compativel", () => {
    const planNotice = baseNotice({ audienceType: "plan", audienceFilter: { type: "plan", planNames: ["800 Mega"] } });
    expect(matchesAudience(planNotice, { customerId: "c1", contract })).toBe(true);
    expect(matchesAudience(planNotice, { customerId: "c1", contract: { ...contract, planName: "400 Mega" } })).toBe(false);

    const cityNotice = baseNotice({ audienceType: "city", audienceFilter: { type: "city", cities: ["Franco da Rocha"] } });
    expect(matchesAudience(cityNotice, { customerId: "c1", contract })).toBe(true);
    expect(matchesAudience(cityNotice, { customerId: "c1", contract: undefined })).toBe(false);

    const statusNotice = baseNotice({
      audienceType: "contract_status",
      audienceFilter: { type: "contract_status", statuses: ["SUSPENDED"] }
    });
    expect(matchesAudience(statusNotice, { customerId: "c1", contract })).toBe(false);
    expect(matchesAudience(statusNotice, { customerId: "c1", contract: { ...contract, status: "SUSPENDED" } })).toBe(true);
  });
});
