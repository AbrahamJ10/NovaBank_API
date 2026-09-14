import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

// Sends via the user's own Gmail account (an "app password", not the normal
// login password) rather than a transactional provider — free, and without
// Resend's sandbox restriction of only delivering to the account owner's own
// address, since a verified sending domain wasn't available.
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    try {
      await getTransporter().sendMail({ from: `"NovaBank" <${env.GMAIL_USER}>`, to, subject, html });
      return;
    } catch (err) {
      console.error("Gmail SMTP error:", err);
      throw new HttpError(502, "No se pudo enviar el correo, intenta de nuevo");
    }
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
