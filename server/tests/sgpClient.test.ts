import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SgpUraClient } from "../src/integrations/sgp/sgpClient.js";
import type { AppConfig } from "../src/config.js";

function buildConfig(): AppConfig["sgp"] {
  return {
    enabled: true,
    baseUrl: "https://sgp.test",
    app: "noc",
    token: "test-token",
    basicUsername: undefined,
    basicPassword: undefined,
    timeoutMs: 8000,
    cpfSearchFields: ["cpfcnpj"],
    chamado: { app: undefined, token: undefined, timeoutMs: 15000, semOs: undefined, mapping: {} },
    sign: { enabled: false, app: undefined, token: undefined, timeoutMs: 10000 }
  };
}

describe("SgpUraClient.consultCustomerByContract", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ contratos: [{ id_contrato: "5989" }] })
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deduplica chamadas concorrentes pro mesmo contrato numa unica requisicao ao SGP", async () => {
    const client = new SgpUraClient(buildConfig());

    const [first, second] = await Promise.all([
      client.consultCustomerByContract("5989"),
      client.consultCustomerByContract("5989")
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("reaproveita o cache numa segunda chamada sequencial dentro do TTL, sem nova requisicao ao SGP", async () => {
    const client = new SgpUraClient(buildConfig());

    await client.consultCustomerByContract("5989");
    await client.consultCustomerByContract("5989");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("nao mistura cache entre contratos diferentes", async () => {
    const client = new SgpUraClient(buildConfig());

    await client.consultCustomerByContract("5989");
    await client.consultCustomerByContract("1234");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("SgpUraClient.listInvoicesByContract", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ titulos: [{ id: "1", numeroDocumento: "1", status: "aberto" }], paginacao: { total: 1 } })
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deduplica chamadas concorrentes pro mesmo contrato (ex: getBillingSummary + rota /invoices na mesma carga de pagina)", async () => {
    const client = new SgpUraClient(buildConfig());

    const [first, second] = await Promise.all([
      client.listInvoicesByContract("5989"),
      client.listInvoicesByContract("5989")
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("reaproveita o cache numa segunda chamada sequencial dentro do TTL", async () => {
    const client = new SgpUraClient(buildConfig());

    await client.listInvoicesByContract("5989");
    await client.listInvoicesByContract("5989");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
