import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

// Brevo's transactional email HTTP API (https://api.brevo.com) — chosen
// over raw SMTP (Gmail, etc.) because outbound SMTP ports are unreliable
// or blocked on Render's free tier; this rides plain HTTPS instead. Only
// a single verified sender email is required (no domain purchase) and,
// once verified, it can send to any recipient.
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (env.BREVO_API_KEY && env.BREVO_FROM_EMAIL) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "NovaBank", email: env.BREVO_FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      console.error("Brevo error:", res.status, await res.text().catch(() => ""));
      throw new HttpError(502, "No se pudo enviar el correo, intenta de nuevo");
    }
    return;
  }

  if (env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text().catch(() => ""));
      throw new HttpError(502, "No se pudo enviar el correo, intenta de nuevo");
    }
    return;
  }

  throw new HttpError(503, "El servicio de correo no está configurado");
}
