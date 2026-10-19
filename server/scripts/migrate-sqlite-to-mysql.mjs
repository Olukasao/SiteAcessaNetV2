#!/usr/bin/env node
// Copia os dados existentes do data/auth.sqlite pro banco MySQL configurado
// em MYSQL_* (.env) -- passo de UMA VEZ antes de trocar DB_DRIVER=mysql em
// producao, senao os clientes ja cadastrados (senha, sessao) ficariam pra
// tras na troca.
//
// Idempotente: usa INSERT IGNORE, entao rodar de novo nao duplica nem falha
// se parte dos dados ja tiver sido copiada numa tentativa anterior.
//
// Uso: node scripts/migrate-sqlite-to-mysql.mjs
// Le SQLITE_PATH e MYSQL_* do mesmo .env que o servidor usa.

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(serverRoot, ".env") });

const sqlitePath = process.env.SQLITE_PATH ?? path.join(serverRoot, "data", "auth.sqlite");

const mysqlConfig = {
  host: process.env.MYSQL_HOST ?? "localhost",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? ""
};

if (!mysqlConfig.user || !mysqlConfig.password || !mysqlConfig.database) {
  console.error("MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE ausentes no .env -- nada a fazer.");
  process.exit(1);
}

const TABLES = [
  "customer_auth_profiles",
  "auth_sessions",
  "auth_login_attempts",
  "auth_audit_logs",
  "password_reset_requests",
  "admin_users",
  "admin_sessions",
  "admin_login_attempts",
  "central_notices",
  "central_notice_views",
  "admin_audit_logs"
];

async function main() {
  console.log(`SQLite origem: ${sqlitePath}`);
  console.log(`MySQL destino: ${mysqlConfig.user}@${mysqlConfig.host}:${mysqlConfig.port}/${mysqlConfig.database}`);

  const db = new DatabaseSync(sqlitePath);
  const pool = mysql.createPool({ ...mysqlConfig, dateStrings: true, timezone: "Z" });

  // Schema do MySQL precisa existir antes -- importado de dist/ (build ja
  // rodado) em vez de reimplementar aqui, pra nunca divergir do schema real.
  const { migrateMysql } = await import("../dist/repositories/mysql.js");
  await migrateMysql(pool);

  let totalCopied = 0;
  for (const table of TABLES) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) {
      console.log(`${table}: 0 linhas (nada a copiar)`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const placeholders = `(${columns.map(() => "?").join(", ")})`;
    const sql = `INSERT IGNORE INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`;

    let copied = 0;
    for (const row of rows) {
      const values = columns.map((col) => row[col]);
      const [result] = await pool.execute(sql, values);
      copied += result.affectedRows;
    }

    console.log(`${table}: ${copied}/${rows.length} linhas copiadas (diferenca = ja existiam, INSERT IGNORE)`);
    totalCopied += copied;
  }

  await pool.end();
  db.close();
  console.log(`\nTotal copiado: ${totalCopied} linhas.`);
  console.log("Confira os dados no MySQL antes de trocar DB_DRIVER=mysql em producao.");
}

main().catch((error) => {
  console.error("FALHOU:", error);
  process.exit(1);
});
