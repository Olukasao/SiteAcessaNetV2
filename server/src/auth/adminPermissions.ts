import { AppError } from "../errors.js";

export type AdminRole = "admin" | "editor" | "viewer";

export type AdminPermission =
  | "avisos.read"
  | "avisos.create"
  | "avisos.update"
  | "avisos.delete"
  | "avisos.publish"
  /** Solicitacoes de Contratacao Online: contem dados pessoais (nome, WhatsApp, endereco). */
  | "contratacoes.read"
  | "contratacoes.update";

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
    "contratacoes.update"
  ]),
  editor: new Set(["avisos.read", "avisos.create", "avisos.update", "avisos.publish", "contratacoes.read", "contratacoes.update"]),
  /** viewer nao ve contratacoes: dados pessoais so para quem atende o pedido. */
  viewer: new Set(["avisos.read"])
};

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
