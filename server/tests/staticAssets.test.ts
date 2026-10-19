import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../src/app.js";
import { createContainer } from "../src/container.js";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("assets no deploy híbrido", () => {
  it("retorna 404 sem cache para um módulo apagado e mantém o fallback apenas para páginas", async () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "acessanet-assets-"));
    directories.push(staticDir);
    fs.mkdirSync(path.join(staticDir, "assets"));
    fs.writeFileSync(path.join(staticDir, "index.html"), "<html>site novo</html>");
    fs.writeFileSync(path.join(staticDir, "legacy.html"), "<html>admin legado</html>");
    fs.writeFileSync(path.join(staticDir, "assets", "kept-old-hash.js"), "export default 1;");
    const app = await buildApp(createContainer({ env: "test", dbDriver: "sqlite", sqlitePath: ":memory:", staticDir, sgp: { basicUsername: "test", basicPassword: "test" } }));
    try {
      for (const url of ["/assets/deleted-old-hash.js", "/assets/deleted-old-hash.css?x=1"]) {
        const response = await app.inject({ method: "GET", url });
        expect(response.statusCode).toBe(404);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.headers["content-type"]).toContain("application/json");
      }
      const kept = await app.inject({ method: "GET", url: "/assets/kept-old-hash.js" });
      expect(kept.statusCode).toBe(200);
      expect(kept.headers["content-type"]).toContain("javascript");
      for (const url of ["/", "/contratos", "/cliente", "/cliente/faturas", "/cliente/guia-wifi"]) {
        expect((await app.inject({ method: "GET", url })).body).toBe("<html>site novo</html>");
      }
      expect((await app.inject({ method: "GET", url: "/admin" })).body).toBe("<html>admin legado</html>");
      expect((await app.inject({ method: "GET", url: "/api/does-not-exist" })).headers["content-type"]).toContain("application/json");
    } finally {
      await app.close();
    }
  });
});
