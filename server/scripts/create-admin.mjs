#!/usr/bin/env node
// Cria (ou atualiza a senha de) uma conta admin do modulo "Avisos da
// Central". Nao existe endpoint publico de signup admin de proposito --
// bootstrap sempre direto no banco.
//
// Uso: node scripts/create-admin.mjs <email> <senha> [nome] [role]
// role: admin (default) | editor | viewer

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { hashPassword, randomId } from "../dist/security/hash.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(serverRoot, ".env") });

const [, , email, password, name = "Admin", role = "admin"] = process.argv;

if (!email || !password) {
  console.error("Uso: node scripts/create-admin.mjs <email> <senha> [nome] [role]");
  process.exit(1);
}

const dbDriver = process.env.DB_DRIVER === "mysql" ? "mysql" : "sqlite";

async function getRepo() {
  if (dbDriver === "mysql") {
    const { createMysqlPool, migrateMysql } = await import("../dist/repositories/mysql.js");
    const { MysqlAdminUserRepository } = await import("../dist/repositories/adminUserRepository.js");
    const pool = createMysqlPool({
      host: process.env.MYSQL_HOST ?? "localhost",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "",
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE ?? ""
    });
    await migrateMysql(pool);
    return { repo: new MysqlAdminUserRepository(pool), close: () => pool.end() };
  }

  const { createDatabase } = await import("../dist/repositories/sqlite.js");
  const { SqliteAdminUserRepository } = await import("../dist/repositories/adminUserRepository.js");
  const sqlitePath = process.env.SQLITE_PATH ?? path.join(serverRoot, "data", "auth.sqlite");
  const db = createDatabase(sqlitePath);
  return { repo: new SqliteAdminUserRepository(db), close: () => db.close() };
}

async function main() {
  console.log(`DB driver: ${dbDriver}`);
  const { repo, close } = await getRepo();

  const passwordHash = await hashPassword(password);
  const existing = await repo.findByEmail(email);

  if (existing) {
    await repo.updatePassword(existing.id, passwordHash);
    console.log(`Conta ja existia (id=${existing.id}) -- senha atualizada.`);
  } else {
    const created = await repo.create({ id: randomId("admin"), email, name, passwordHash, role });
    console.log(`Conta criada: id=${created.id} email=${created.email} role=${created.role}`);
  }

  await close();
}

main().catch((error) => {
  console.error("FALHOU:", error);
  process.exit(1);
});
