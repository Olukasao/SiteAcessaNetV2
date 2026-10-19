import { describe, expect, it } from "vitest";
import { getSignatureStatusLabel, mapSgpSignatureStatus } from "../src/integrations/sgp/signatureStatusMapper.js";

describe("mapSgpSignatureStatus", () => {
  it("mapeia os 5 status confirmados no relatorio oficial do SGP", () => {
    expect(mapSgpSignatureStatus("Em processamento")).toBe("pending");
    expect(mapSgpSignatureStatus("Assinado aguardando validação")).toBe("awaiting_validation");
    expect(mapSgpSignatureStatus("Assinado")).toBe("signed");
    expect(mapSgpSignatureStatus("Finalizado")).toBe("finished");
    expect(mapSgpSignatureStatus("Cancelado")).toBe("canceled");
  });

  it("distingue 'signed' de 'finished' -- sao estados diferentes no fluxo oficial", () => {
    expect(mapSgpSignatureStatus("assinado")).toBe("signed");
    expect(mapSgpSignatureStatus("finalizado")).not.toBe(mapSgpSignatureStatus("assinado"));
  });

  it("e tolerante a acentos, caixa e espacos", () => {
    expect(mapSgpSignatureStatus("Aguardando Validação")).toBe("awaiting_validation");
    expect(mapSgpSignatureStatus("  assinado  ")).toBe("signed");
  });

  it("nunca inventa um status conhecido para string desconhecida", () => {
    expect(mapSgpSignatureStatus("algo_que_o_sgp_nunca_mandou")).toBe("unknown");
  });
});

describe("getSignatureStatusLabel", () => {
  it("devolve o texto em portugues para cada status", () => {
    expect(getSignatureStatusLabel("pending")).toBe("Assinatura pendente");
    expect(getSignatureStatusLabel("signed")).toBe("Assinado");
    expect(getSignatureStatusLabel("finished")).toBe("Finalizado");
    expect(getSignatureStatusLabel("unknown")).toBe("Status indisponível");
  });
});
