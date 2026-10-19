import { AppError } from "../errors.js";
import { safeEqual } from "../security/hash.js";

export interface PasswordPolicyOptions {
  /** Senha inicial do SGP (ex.: "1234"). Nunca pode ser reescolhida como senha nova. */
  initialPassword: string;
  /** Senha atual do cliente, quando conhecida, para bloquear "nova senha = senha atual". */
  currentPassword?: string;
}

/**
 * Politica de senha unica e reutilizavel para todo o backend.
 *
 * Regras (secao 40 da especificacao):
 *  - minimo 8 caracteres
 *  - pelo menos 1 letra
 *  - pelo menos 1 numero
 *  - nao pode ser igual a senha inicial do SGP (evita repetir "1234")
 *  - nao pode ser igual a senha atual (quando informada)
 *
 * Estas regras foram escolhidas por serem um piso conservador que qualquer
 * politica de senha do SGP deveria aceitar (letras + numeros, sem exigir
 * caracteres especiais). Elas NAO foram confirmadas com uma especificacao
 * oficial do SGP para o modulo de autenticacao de clientes -- se o SGP
 * rejeitar uma senha que passe nesta validacao local, o erro do SGP deve
 * prevalecer e ser traduzido para PASSWORD_POLICY_REJECTED (ver
 * passwordAuthService.ts), nunca contradito por esta funcao.
 */
export function validateNewPassword(newPassword: string, options: PasswordPolicyOptions) {
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new AppError(400, "PASSWORD_POLICY_REJECTED", "A nova senha deve ter pelo menos 8 caracteres.");
  }

  if (newPassword.length > 128) {
    throw new AppError(400, "PASSWORD_POLICY_REJECTED", "A nova senha informada e invalida.");
  }

  if (!/[A-Za-z]/.test(newPassword)) {
    throw new AppError(400, "PASSWORD_POLICY_REJECTED", "A nova senha deve conter pelo menos uma letra.");
  }

  if (!/[0-9]/.test(newPassword)) {
    throw new AppError(400, "PASSWORD_POLICY_REJECTED", "A nova senha deve conter pelo menos um numero.");
  }

  if (constantTimeStringEquals(newPassword, options.initialPassword)) {
    throw new AppError(400, "PASSWORD_POLICY_REJECTED", "Escolha uma senha diferente da senha inicial.");
  }

  if (options.currentPassword && constantTimeStringEquals(newPassword, options.currentPassword)) {
    throw new AppError(400, "PASSWORD_POLICY_REJECTED", "A nova senha deve ser diferente da senha atual.");
  }
}

/** Compara duas senhas em tempo constante, sem nunca logar os valores comparados. */
function constantTimeStringEquals(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return safeEqual(a, b);
}
