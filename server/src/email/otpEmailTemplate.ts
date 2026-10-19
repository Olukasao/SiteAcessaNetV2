interface OtpEmailInput {
  name: string;
  code: string;
}

const BRAND_DARK_BLUE = "#0b2545";
const BRAND_CYAN = "#00b4d8";
const BRAND_WHITE = "#ffffff";
const BRAND_MUTED = "#5b6b82";

/**
 * E-mail transacional (codigo de recuperacao de senha) -- nunca reutilizar
 * para marketing/newsletter, para nao prejudicar a reputacao do dominio.
 * HTML com tabelas + estilos inline (compatibilidade ampla de clientes de
 * e-mail), sem imagens/scripts/fontes externas, com alternativa text/plain.
 */
export function renderOtpEmailHtml(input: OtpEmailInput): string {
  const firstName = (input.name || "").trim().split(/\s+/)[0] || "cliente";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${OTP_EMAIL_SUBJECT}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#eef2f7; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:${BRAND_WHITE}; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="background-color:${BRAND_DARK_BLUE}; padding:24px 32px; text-align:center;">
                <span style="color:${BRAND_WHITE}; font-size:20px; font-weight:bold; letter-spacing:0.5px;">Acessanet</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px; color:${BRAND_DARK_BLUE}; font-size:16px;">Olá, ${escapeHtml(firstName)}.</p>
                <p style="margin:0 0 24px; color:${BRAND_MUTED}; font-size:14px; line-height:1.6;">
                  Recebemos uma solicitação para redefinir a senha da sua Área do Cliente Acessanet. Use o código abaixo para continuar.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background-color:#f0fbfd; border:1px solid ${BRAND_CYAN}; border-radius:8px; padding:20px;">
                      <span style="color:${BRAND_DARK_BLUE}; font-size:32px; font-weight:bold; letter-spacing:8px;">${escapeHtml(input.code)}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0; color:${BRAND_MUTED}; font-size:13px; line-height:1.6;">
                  O código é válido por 10 minutos. Se você não solicitou esta alteração, ignore esta mensagem -- sua senha continua a mesma.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px; text-align:center;">
                <span style="color:${BRAND_MUTED}; font-size:12px;">Acessanet &middot; e-mail transacional, não responda esta mensagem.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderOtpEmailText(input: OtpEmailInput): string {
  const firstName = (input.name || "").trim().split(/\s+/)[0] || "cliente";

  return [
    `Olá, ${firstName}.`,
    "",
    "Recebemos uma solicitação para redefinir a senha da sua Área do Cliente Acessanet.",
    "",
    `Seu código de verificação é: ${input.code}`,
    "",
    "O código é válido por 10 minutos.",
    "",
    "Se você não solicitou esta alteração, ignore esta mensagem.",
    "",
    "Acessanet"
  ].join("\n");
}

const OTP_EMAIL_SUBJECT = "Código de verificação Acessanet";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
