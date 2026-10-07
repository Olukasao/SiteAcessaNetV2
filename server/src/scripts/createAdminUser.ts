/**
 * Cria (ou atualiza a senha/role de) um usuario administrativo do modulo
 * "Avisos da Central". Nunca roda automaticamente no boot do servidor --
 * so via `tsx src/scripts/createAdminUser.ts`, pra nunca existir senha
 * default nenhuma gravada no repositorio.
 *
 * Uso:
 *   ADMIN_BOOTSTRAP_PASSWORD='SenhaForte123!' \
 *     tsx src/scripts/createAdminUser.ts --email=admin@acessanet.com --name="Nome" --role=admin
 */
import { loadConfig } from "../config.js";
import { createDatabase } from "../repositories/sqlite.js";
import { SqliteAdminUserRepository } from "../repositories/adminUserRepository.js";
import { hashPassword, randomId } from "../security/hash.js";
import type { AdminRole } from "../auth/adminPermissions.js";

function parseArgs(argv: string[]) {
  const result: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-zA-Z]+)=(.*)$/.exec(arg);
    if (match?.[1] && match[2] !== undefined) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.trim().toLowerCase();
  const name = args.name?.trim();
  const role = args.role?.trim() as AdminRole | undefined;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !name || !role || !password) {
    console.error(
      "Uso: ADMIN_BOOTSTRAP_PASSWORD='...' tsx src/scripts/createAdminUser.ts --email=... --name=... --role=admin|editor|viewer"
    );
    process.exitCode = 1;
    return;
  }

  if (!["admin", "editor", "viewer"].includes(role)) {
    console.error('role invalido -- use "admin", "editor" ou "viewer".');
    process.exitCode = 1;
    return;
  }

  if (password.length < 12) {
    console.error("ADMIN_BOOTSTRAP_PASSWORD precisa ter pelo menos 12 caracteres.");
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const db = createDatabase(config.sqlitePath);
  const adminUsers = new SqliteAdminUserRepository(db);

  const passwordHash = await hashPassword(password);
  const existing = await adminUsers.findByEmail(email);

  if (existing) {
    await adminUsers.updatePassword(existing.id, passwordHash);
    console.log(`Senha atualizada para o admin existente: ${email} (role atual: ${existing.role}).`);
    return;
  }

  await adminUsers.create({ id: randomId("admin"), email, name, passwordHash, role });
  console.log(`Admin criado: ${email} (role: ${role}).`);
}

main().catch((error) => {
  console.error("Falha ao criar/atualizar admin:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
