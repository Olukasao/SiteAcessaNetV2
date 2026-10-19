import { describe, expect, it } from "vitest";
import { isLegacySpaPath } from "../src/app.js";

describe("isLegacySpaPath", () => {
  it("manda admin e documentos para o build antigo", () => {
    for (const url of ["/admin", "/admin/leads", "/assinar-documento?t=a", "/dados/mundiale/preencher"]) {
      expect(isLegacySpaPath(url)).toBe(true);
    }
  });

  it("deixa o resto com o site novo", () => {
    for (const url of ["/cliente", "/cliente/", "/cliente/faturas?x=1", "/cliente/internet", "/cliente/perfil", "/", "/planos", "/cliente/guia-wifi", "/clientes", "/administracao", "/lgpd", "/historia"]) {
      expect(isLegacySpaPath(url)).toBe(false);
    }
  });
});
