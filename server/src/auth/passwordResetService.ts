import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { hashPassword, hmacSha256, randomId, randomOtp, randomToken, safeEqual, sha256 } from "../security/hash.js";
import { isValidCpf, maskCpf, normalizeCpf } from "./cpf.js";
import { validateNewPassword } from "./passwordPolicy.js";
import type { InMemoryRateLimiter } from "./rateLimiter.js";
import type { CpfResolverResult } from "./cpfResolver.js";
import type { AuthProfileRepository } from "../repositories/authProfileRepository.js";
import type { SessionRepository } from "../repositories/sessionRepository.js";
import type { PasswordResetRepository, PasswordResetRequestRecord } from "../repositories/passwordResetRepository.js";
import type { AuditLogRepository, AuthFailureReason } from "../repositories/auditLogRepository.js";
import type { Mailer } from "../email/mailer.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const REQUEST_RULE = { limit: 5, windowMs: 15 * 60 * 1000, cooldownMs: 60_000 };
const VERIFY_RULE = { limit: 10, windowMs: 15 * 60 * 1000, cooldownMs: 60_000 };

const GENERIC_SENT_MESSAGE = "Se os dados informados estiverem cadastrados, enviaremos as instruções de recuperação.";
const GENERIC_CODE_INVALID_MESSAGE = "Código inválido.";
const GENERIC_UNAVAILABLE_MESSAGE = "Não foi possível concluir agora. Tente novamente em alguns instantes.";

/** Mesma senha inicial generica bloqueada pelo fluxo de primeiro acesso (ver localPasswordAuthService.ts). */
const GENERIC_INITIAL_PASSWORD = "acessanet";

export interface MaskedEmailResult {
  maskedEmail: string;
}

/**
 * Fluxo "esqueci minha senha": CPF -> OTP por e-mail -> reset_token -> nova
 * senha. Nunca revela se um CPF existe (mensagem generica sempre igual) e
 * nunca usa um e-mail vindo do frontend -- o e-mail e sempre resolvido no
 * backend a partir do CPF, via SGP (ver auth/cpfResolver.ts).
 */
export class PasswordResetService {
  constructor(
    private readonly config: AppConfig,
    private readonly cpfResolver: { resolve: (cpf: string) => Promise<CpfResolverResult | null> },
    private readonly authProfiles: AuthProfileRepository,
    private readonly sessions: SessionRepository,
    private readonly passwordResets: PasswordResetRepository,
    private readonly mailer: Mailer,
    private readonly auditLog: AuditLogRepository,
    private readonly rateLimiter: InMemoryRateLimiter
  ) {}

  private cpfHash(digits: string) {
    return hmacSha256(digits, this.config.cpfHashSecret);
  }

  private otpHash(code: string) {
    return hmacSha256(code, this.config.otpHashSecret);
  }

  private ipHash(ip: string) {
    return sha256(ip || "unknown");
  }

  /**
   * Passo 1: sempre devolve a mesma mensagem generica, exista ou nao o CPF,
   * tenha ou nao e-mail cadastrado, esteja ou nao em cooldown -- so isso
   * evita enumeracao de clientes. So dispara e-mail de verdade quando o CPF
   * resolve no SGP, tem e-mail cadastrado e o cooldown de 60s ja passou.
   */
  async requestReset(input: { cpf: string; ip: string }): Promise<{ message: string }> {
    const digits = normalizeCpf(input.cpf);
    this.rateLimiter.consume(`password_reset_request:ip:${input.ip}`, REQUEST_RULE);

    if (!isValidCpf(digits)) {
      return { message: GENERIC_SENT_MESSAGE };
    }

    const cpfHash = this.cpfHash(digits);
    const ipHash = this.ipHash(input.ip);
    const maskedCpf = maskCpf(digits);

    let resolved: CpfResolverResult | null;
    try {
      resolved = await this.cpfResolver.resolve(digits);
    } catch {
      return { message: GENERIC_SENT_MESSAGE };
    }

    if (!resolved || !resolved.customer.email) {
      return { message: GENERIC_SENT_MESSAGE };
    }

    const latest = await this.passwordResets.findLatestByCpfHash(cpfHash);
    if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return { message: GENERIC_SENT_MESSAGE };
    }

    const code = randomOtp();
    const request = await this.passwordResets.createRequest({
      id: randomId("pwreset"),
      cpfHash,
      otpHash: this.otpHash(code),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      ipHash
    });

    try {
      await this.mailer.sendOtpEmail({ to: resolved.customer.email, name: resolved.customer.name, code });
    } catch {
      await this.passwordResets.markOtpUsed(request.id, new Date());
      await this.auditLog.record({
        eventType: "PASSWORD_RESET_REQUESTED",
        customerId: resolved.customer.id,
        cpfHash,
        cpfMasked: maskedCpf,
        ipHash,
        status: "FAILED",
        failureReason: "EMAIL_SEND_FAILED"
      });
      return { message: GENERIC_SENT_MESSAGE };
    }

    await this.auditLog.record({
      eventType: "PASSWORD_RESET_REQUESTED",
      customerId: resolved.customer.id,
      cpfHash,
      cpfMasked: maskedCpf,
      ipHash,
      status: "SUCCESS"
    });

    return { message: GENERIC_SENT_MESSAGE };
  }

  /** Devolve o e-mail mascarado pro passo 2 da tela, sem nunca expor o endereco completo. Mesma mensagem generica se o CPF nao resolver. */
  async getMaskedEmail(input: { cpf: string }): Promise<MaskedEmailResult> {
    const digits = normalizeCpf(input.cpf);
    if (!isValidCpf(digits)) {
      throw new AppError(404, "CUSTOMER_NOT_FOUND", "Não encontramos um cliente com os dados informados.");
    }

    let resolved: CpfResolverResult | null;
    try {
      resolved = await this.cpfResolver.resolve(digits);
    } catch {
      throw new AppError(502, "SGP_UNAVAILABLE", GENERIC_UNAVAILABLE_MESSAGE);
    }

    if (!resolved || !resolved.customer.maskedEmail) {
      throw new AppError(404, "CUSTOMER_NOT_FOUND", "Não encontramos um cliente com os dados informados.");
    }

    return { maskedEmail: resolved.customer.maskedEmail };
  }

  /** Passo 2: valida o codigo e devolve um reset_token de uso unico (10 min) para o passo 3. */
  async verifyCode(input: { cpf: string; code: string; ip: string }): Promise<{ resetToken: string }> {
    const digits = normalizeCpf(input.cpf);
    this.rateLimiter.consume(`password_reset_verify:ip:${input.ip}`, VERIFY_RULE);

    if (!isValidCpf(digits)) {
      throw new AppError(400, "CODE_INVALID", GENERIC_CODE_INVALID_MESSAGE);
    }

    const cpfHash = this.cpfHash(digits);
    const ipHash = this.ipHash(input.ip);
    const maskedCpf = maskCpf(digits);

    const request = await this.passwordResets.findActiveByCpfHash(cpfHash);
    if (!request) {
      await this.registerVerifyFailure(cpfHash, maskedCpf, ipHash, "OTP_NOT_FOUND");
      throw new AppError(400, "CODE_INVALID", GENERIC_CODE_INVALID_MESSAGE);
    }

    if (request.otpExpiresAt.getTime() <= Date.now()) {
      await this.passwordResets.markOtpUsed(request.id, new Date());
      await this.registerVerifyFailure(cpfHash, maskedCpf, ipHash, "OTP_EXPIRED");
      throw new AppError(400, "CODE_EXPIRED", "Código expirado. Solicite um novo código.");
    }

    if (request.otpAttempts >= OTP_MAX_ATTEMPTS) {
      await this.passwordResets.markOtpUsed(request.id, new Date());
      await this.registerVerifyFailure(cpfHash, maskedCpf, ipHash, "OTP_ATTEMPTS_EXCEEDED");
      throw new AppError(400, "TOO_MANY_ATTEMPTS", "Muitas tentativas. Solicite um novo código.");
    }

    const providedHash = this.otpHash(input.code.trim());
    const isMatch = safeEqual(providedHash, request.otpHash);

    if (!isMatch) {
      const attempts = await this.passwordResets.incrementOtpAttempts(request.id);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await this.passwordResets.markOtpUsed(request.id, new Date());
        await this.registerVerifyFailure(cpfHash, maskedCpf, ipHash, "OTP_ATTEMPTS_EXCEEDED");
        throw new AppError(400, "TOO_MANY_ATTEMPTS", "Muitas tentativas. Solicite um novo código.");
      }
      await this.registerVerifyFailure(cpfHash, maskedCpf, ipHash, "OTP_INVALID");
      throw new AppError(400, "CODE_INVALID", GENERIC_CODE_INVALID_MESSAGE);
    }

    const resetToken = randomToken();
    const resetTokenHash = sha256(resetToken);
    await this.passwordResets.setResetToken(request.id, resetTokenHash, new Date(Date.now() + RESET_TOKEN_TTL_MS));
    await this.passwordResets.markOtpUsed(request.id, new Date());

    await this.auditLog.record({
      eventType: "PASSWORD_RESET_CODE_VERIFIED",
      cpfHash,
      cpfMasked: maskedCpf,
      ipHash,
      status: "SUCCESS"
    });

    return { resetToken };
  }

  /** Passo 3: troca a senha usando o reset_token (uso unico, 10 min), invalida outras sessoes do cliente. */
  async resetPassword(input: { resetToken: string; newPassword: string; confirmPassword: string; ip: string }): Promise<void> {
    const ipHash = this.ipHash(input.ip);

    if (input.newPassword !== input.confirmPassword) {
      throw new AppError(400, "VALIDATION_ERROR", "As senhas não coincidem.");
    }

    const resetTokenHash = sha256(input.resetToken);
    const request = await this.passwordResets.findByResetTokenHash(resetTokenHash);

    if (!request || !request.resetTokenExpiresAt || request.resetTokenUsedAt) {
      await this.auditLog.record({
        eventType: "PASSWORD_RESET_COMPLETED",
        ipHash,
        status: "FAILED",
        failureReason: "RESET_TOKEN_INVALID"
      });
      throw new AppError(400, "RESET_TOKEN_INVALID", "Não foi possível redefinir a senha. Solicite a recuperação novamente.");
    }

    if (request.resetTokenExpiresAt.getTime() <= Date.now()) {
      await this.auditLog.record({
        eventType: "PASSWORD_RESET_COMPLETED",
        cpfHash: request.cpfHash,
        ipHash,
        status: "FAILED",
        failureReason: "RESET_TOKEN_EXPIRED"
      });
      throw new AppError(400, "RESET_TOKEN_EXPIRED", "Sessão de redefinição expirada. Solicite a recuperação novamente.");
    }

    validateNewPassword(input.newPassword, { initialPassword: GENERIC_INITIAL_PASSWORD });

    const profile = await this.authProfiles.getOrCreate({
      cpfHash: request.cpfHash,
      cpfLastDigits: "",
      sgpCustomerId: null
    });

    const passwordHash = await hashPassword(input.newPassword);
    const now = new Date();
    await this.authProfiles.setPasswordHash(request.cpfHash, passwordHash, now);
    await this.passwordResets.markResetTokenUsed(request.id, now);
    await this.sessions.revokeAllForCpfHash(request.cpfHash, now);

    await this.auditLog.record({
      eventType: "PASSWORD_RESET_COMPLETED",
      customerId: profile.sgpCustomerId ?? undefined,
      cpfHash: request.cpfHash,
      ipHash,
      status: "SUCCESS"
    });
  }

  private async registerVerifyFailure(cpfHash: string, cpfMasked: string, ipHash: string, reason: AuthFailureReason) {
    await this.auditLog.record({
      eventType: "PASSWORD_RESET_CODE_VERIFIED",
      cpfHash,
      cpfMasked,
      ipHash,
      status: "FAILED",
      failureReason: reason
    });
  }
}
