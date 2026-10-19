import { describe, expect, it } from "vitest";
import { parseSaoPauloDate, startOfSaoPauloDay } from "../src/analytics/saoPauloTime.js";

describe("saoPauloTime", () => {
  it("começa o dia às 00:00 de Brasília, não à meia-noite UTC", () => {
    // 22h de 18/10 em SP ainda é dia 18, mesmo já sendo 19/10 em UTC.
    expect(startOfSaoPauloDay(new Date("2026-10-19T01:00:00Z")).toISOString()).toBe("2026-10-18T03:00:00.000Z");
    expect(startOfSaoPauloDay(new Date("2026-10-19T10:00:00Z")).toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });

  it("lê a data do filtro como dia de Brasília", () => {
    expect(parseSaoPauloDate("2026-10-15")?.toISOString()).toBe("2026-10-15T03:00:00.000Z");
    expect(parseSaoPauloDate("nao-e-data")).toBeNull();
  });
});
