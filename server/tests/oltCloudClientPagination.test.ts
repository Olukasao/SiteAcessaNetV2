import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OltCloudClient } from "../src/integrations/oltcloud/oltCloudClient.js";

function buildConfig() {
  return { baseUrl: "https://api.oltcloud.test", token: "test-token", timeoutMs: 8000 };
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("OltCloudClient.listEquipment (paginacao)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("junta todas as paginas quando a resposta traz 'next' como numero de pagina", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ equipment: [{ id: "1" }, { id: "2" }], next: 2 }))
      .mockResolvedValueOnce(jsonResponse({ equipment: [{ id: "3" }], next: null }));

    const client = new OltCloudClient(buildConfig());
    const equipment = await client.listEquipment({ olt_id: "14", slot: "1", pon: "0/1/3" });

    expect(equipment).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallUrl = fetchMock.mock.calls[1]?.[0] as string;
    expect(secondCallUrl).toContain("page=2");
  });

  it("junta todas as paginas quando a resposta traz 'next' como URL relativa", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: "a" }], next: "/api/v2/ftth/equipment/list?cursor=xyz" }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: "b" }], next: "" }));

    const client = new OltCloudClient(buildConfig());
    const equipment = await client.listEquipment({ olt_id: "14" });

    expect(equipment).toEqual([{ id: "a" }, { id: "b" }]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.oltcloud.test/api/v2/ftth/equipment/list?cursor=xyz");
  });

  it("para na primeira pagina quando a resposta e um array puro (sem metadado de paginacao)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "1" }, { id: "2" }]));

    const client = new OltCloudClient(buildConfig());
    const equipment = await client.listEquipment({ olt_id: "14" });

    expect(equipment).toEqual([{ id: "1" }, { id: "2" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("para se 'next' repetir a mesma pagina (guarda contra loop infinito)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ equipment: [{ id: "1" }], next: 1 }));

    const client = new OltCloudClient(buildConfig());
    const equipment = await client.listEquipment({ olt_id: "14" });

    expect(equipment).toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("envia page_size alto na primeira chamada", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ equipment: [] }));

    const client = new OltCloudClient(buildConfig());
    await client.listEquipment({ olt_id: "14" });

    const firstCallUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(firstCallUrl).toContain("page_size=1000");
  });
});
