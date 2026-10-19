import nodemailer, { type Transporter } from "nodemailer";
import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { renderOtpEmailHtml, renderOtpEmailText } from "./otpEmailTemplate.js";

export interface Mailer {
  /** Lanca AppError("EMAIL_SEND_FAILED") em caso de falha -- nunca deixa detalhes de SMTP vazarem pro chamador. */
  sendOtpEmail(input: { to: string; name: string; code: string }): Promise<void>;
  /** So testa a conexao/autenticacao (transporter.verify()) -- nao envia nenhum e-mail. */
  verifyConnection(): Promise<{ ok: boolean; error?: string }>;
}

const OTP_EMAIL_SUBJECT = "Código de verificação Acessanet";

export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig["smtp"]) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass }
    });
  }

  async sendOtpEmail(input: { to: string; name: string; code: string }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: input.to,
        subject: OTP_EMAIL_SUBJECT,
        text: renderOtpEmailText(input),
        html: renderOtpEmailHtml(input)
      });
    } catch {
      // Nunca repassar o erro original: pode conter host/usuario/detalhes do provedor SMTP.
      throw new AppError(502, "EMAIL_SEND_FAILED", "Nao foi possivel enviar o codigo agora. Tente novamente em instantes.");
    }
  }

  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Falha desconhecida na verificacao SMTP." };
    }
  }
}

/** Usado quando SMTP_HOST/SMTP_USER/SMTP_PASS nao estao configurados (dev local sem credenciais reais). */
export class UnconfiguredMailer implements Mailer {
  async sendOtpEmail(): Promise<void> {
    throw new AppError(500, "SMTP_NOT_CONFIGURED", "Envio de e-mail nao configurado neste ambiente.");
  }

  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "SMTP_HOST/SMTP_USER/SMTP_PASS ausentes." };
  }
}
