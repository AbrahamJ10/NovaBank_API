import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new HttpError(503, "El servicio de correo no está configurado");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.RESEND_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend error:", res.status, body);
    throw new HttpError(502, "No se pudo enviar el correo, intenta de nuevo");
  }
}
