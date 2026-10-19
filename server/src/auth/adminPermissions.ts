import { AppError } from "../errors.js";

export type AdminRole = "admin" | "editor" | "viewer" | "vendedor";

export type AdminPermission =
  | "avisos.read"
  | "avisos.create"
  | "avisos.update"
  | "avisos.delete"
  | "avisos.publish"
  /** Solicitacoes de Contratacao Online: contem dados pessoais (nome, WhatsApp, endereco). */
  | "contratacoes.read"
  | "contratacoes.update"
  /** Criar/desativar contas de vendedor e redefinir senha. */
  | "usuarios.manage"
  /** Ranking de vendedores (desempenho de cada pessoa). */
  | "ranking.read";

/**
 * Mapa fixo em codigo (nao em banco): time pequeno, sem necessidade de UI de
 * permissoes dinamicas agora. Trocar/adicionar role e uma mudanca de codigo
 * revisada, nao um dado editavel por qualquer admin.
 */
const rolePermissions: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  admin: new Set([
    "avisos.read",
    "avisos.create",
    "avisos.update",
    "avisos.delete",
    "avisos.publish",
    "contratacoes.read",
    "contratacoes.update",
    "usuarios.manage",
    "ranking.read"
  ]),
  editor: new Set([
    "avisos.read",
    "avisos.create",
    "avisos.update",
    "avisos.publish",
    "contratacoes.read",
    "contratacoes.update",
    "ranking.read"
  ]),
  /** vendedor atende os pedidos de contratacao e nada mais (ver roleCanReachAdminPath). */
  vendedor: new Set(["contratacoes.read", "contratacoes.update"]),
  /** viewer nao ve contratacoes: dados pessoais so para quem atende o pedido. */
  viewer: new Set(["avisos.read"])
};

/**
 * Vendedor so alcanca login/sessao e contratacoes: o resto do painel (clientes,
 * chamados, rede, curriculos, leads...) tem dados que ele nao precisa ver.
 * Barreira por caminho no hook global, nao depende de cada rota lembrar.
 */
export function roleCanReachAdminPath(role: AdminRole, url: string) {
  if (role !== "vendedor" && role !== "viewer") return true;
  const pathname = url.split(/[?#]/)[0] ?? "";
  // viewer le avisos e nada mais (ver rolePermissions): sem clientes, chamados, curriculos, leads, rede...
  if (role === "viewer") {
    return pathname.startsWith("/admin/api/auth/") || pathname === "/admin/api/notices" || pathname.startsWith("/admin/api/notices/");
  }
  return (
    pathname.startsWith("/admin/api/auth/") ||
    pathname === "/admin/api/contratacoes" ||
    pathname.startsWith("/admin/api/contratacoes/")
  );
}

/** Papeis que tem a permissao (ex.: quem pode ser responsavel por uma contratacao). */
export function rolesWithPermission(permission: AdminPermission): AdminRole[] {
  return (Object.keys(rolePermissions) as AdminRole[]).filter((role) => rolePermissions[role].has(permission));
}

export function hasPermission(role: AdminRole, permission: AdminPermission) {
  return rolePermissions[role].has(permission);
}

export function requirePermission(role: AdminRole, permission: AdminPermission) {
  if (!hasPermission(role, permission)) {
    throw new AppError(403, "FORBIDDEN", "Voce nao tem permissao para executar esta acao.");
  }
}
