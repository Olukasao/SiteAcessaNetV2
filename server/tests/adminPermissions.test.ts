import { describe, expect, it } from "vitest";
import { hasPermission, requirePermission } from "../src/auth/adminPermissions.js";
import { AppError } from "../src/errors.js";

describe("adminPermissions", () => {
  it("admin tem todas as permissoes, incluindo delete", () => {
    expect(hasPermission("admin", "avisos.delete")).toBe(true);
    expect(hasPermission("admin", "avisos.publish")).toBe(true);
  });

  it("editor cria/edita/publica mas nao exclui", () => {
    expect(hasPermission("editor", "avisos.create")).toBe(true);
    expect(hasPermission("editor", "avisos.publish")).toBe(true);
    expect(hasPermission("editor", "avisos.delete")).toBe(false);
  });

  it("viewer so le", () => {
    expect(hasPermission("viewer", "avisos.read")).toBe(true);
    expect(hasPermission("viewer", "avisos.create")).toBe(false);
    expect(hasPermission("viewer", "avisos.update")).toBe(false);
  });

  it("requirePermission lanca 403 quando a role nao tem a permissao", () => {
    expect(() => requirePermission("viewer", "avisos.delete")).toThrow(AppError);
    try {
      requirePermission("viewer", "avisos.delete");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
    }
  });
});
