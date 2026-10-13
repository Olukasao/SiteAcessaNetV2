import { describe, expect, it } from "vitest";
import { normalizeOltClient } from "../src/integrations/oltcloud/oltClientNormalizer.js";

describe("normalizeOltClient", () => {
  it("nunca inclui pppoe_password, mesmo que venha no registro bruto", () => {
    const raw = {
      id: 1,
      external_id: "5932",
      external_contract_id: "5932",
      client_name: "ABRAAO GOMES DA MATA",
      document: "42601705892",
      pppoe: "abraao_gomes@acessanet.com.br",
      pppoe_password: "senha-em-texto-puro",
      status: "Ativo",
      plan: "ACESSANET"
    };

    const result = normalizeOltClient(raw);

    expect(result).not.toHaveProperty("pppoe_password");
    expect(JSON.stringify(result)).not.toContain("senha-em-texto-puro");
  });

  it("mascara o documento (CPF), nunca devolve em texto puro", () => {
    const result = normalizeOltClient({ document: "42601705892" });

    expect(result.maskedDocument).not.toBe("42601705892");
    expect(result.maskedDocument).toMatch(/^\*{3}\.\*{3}\.\*{3}-\d{2}$/);
  });

  it("mascara documento de 14 digitos (CNPJ) tambem", () => {
    const result = normalizeOltClient({ document: "12345678000199" });

    expect(result.maskedDocument).not.toBe("12345678000199");
    expect(result.maskedDocument).toContain("99");
  });

  it("devolve null para document ausente, sem quebrar", () => {
    const result = normalizeOltClient({ client_name: "Sem documento" });
    expect(result.maskedDocument).toBeNull();
    expect(result.name).toBe("Sem documento");
  });
});
