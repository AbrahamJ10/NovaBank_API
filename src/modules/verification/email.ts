import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

// La API HTTP de correo transaccional de Brevo (https://api.brevo.com) —
// elegida en vez de SMTP directo (Gmail, etc.) porque los puertos SMTP de
// salida no son confiables o están bloqueados en el plan gratuito de
// Render; esto usa HTTPS normal en su lugar. Solo se necesita un correo de
// remitente verificado (sin comprar dominio) y, una vez verificado, puede
// enviar a cualquier destinatario.
export type EmailAttachment = { name: string; content: string }; // content va en base64

export async function sendEmail(destinatario: string, asunto: string, html: string, adjuntos?: EmailAttachment[]): Promise<void> {
  if (env.BREVO_API_KEY && env.BREVO_FROM_EMAIL) {
    const respuesta = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "NovaBank", email: env.BREVO_FROM_EMAIL },
        to: [{ email: destinatario }],
        subject: asunto,
        htmlContent: html,
        ...(adjuntos && adjuntos.length > 0 ? { attachment: adjuntos } : {}),
      }),
    });

    if (!respuesta.ok) {
      console.error("Error de Brevo:", respuesta.status, await respuesta.text().catch(() => ""));
      throw new HttpError(502, "No se pudo enviar el correo, intenta de nuevo");
    }
    return;
  }

  if (env.RESEND_API_KEY) {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: destinatario,
        subject: asunto,
        html,
        ...(adjuntos && adjuntos.length > 0
          ? { attachments: adjuntos.map((a) => ({ filename: a.name, content: a.content })) }
          : {}),
      }),
    });
    if (!respuesta.ok) {
      console.error("Error de Resend:", respuesta.status, await respuesta.text().catch(() => ""));
      throw new HttpError(502, "No se pudo enviar el correo, intenta de nuevo");
    }
    return;
  }

  throw new HttpError(503, "El servicio de correo no está configurado");
}
