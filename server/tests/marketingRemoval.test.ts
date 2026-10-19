import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { requirePermission } from "../src/auth/adminPermissions.js";
import { SqliteWifiRepository } from "../src/wifi/wifiRepository.js";

describe("remocao da lista de marketing", () => {
  it("so admin tem marketing.manage", () => {
    expect(() => requirePermission("admin", "marketing.manage")).not.toThrow();
    for (const role of ["editor", "viewer", "vendedor"] as const) {
      expect(() => requirePermission(role, "marketing.manage")).toThrow();
    }
  });

  it("Wi-Fi: recusa mais recente tira a pessoa da lista e mantem cadastro e historico", async () => {
    const db = new DatabaseSync(":memory:");
    const wifi = new SqliteWifiRepository(db);
    const id = await wifi.upsertVisitor({ fullName: "Maria", email: "m@x.com", phone: "11999999999" }, "v1");
    await wifi.recordConsent(id, "marketing", true, "v");
    expect(await wifi.isMarketingLead(id)).toBe(true);
    expect(await wifi.listMarketingLeads(10)).toHaveLength(1);

    await wifi.recordConsent(id, "marketing", false, "v");
    expect(await wifi.isMarketingLead(id)).toBe(false);
    expect(await wifi.listMarketingLeads(10)).toHaveLength(0);
    expect(await wifi.isMarketingLead("inexistente")).toBe(false);
    // cadastro e os dois consentimentos continuam no banco
    expect(await wifi.upsertVisitor({ fullName: "Maria", email: "m@x.com", phone: "11999999999" }, "outro")).toBe(id);
    expect(db.prepare("SELECT COUNT(*) AS n FROM wifi_consents WHERE visitor_id = ?").get(id)).toEqual({ n: 2 });
  });
});
