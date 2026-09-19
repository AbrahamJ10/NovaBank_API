import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { sendEmail } from "./email";
import type { OtpPurpose } from "@prisma/client";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const EMAIL_COPY: Record<OtpPurpose, { subject: string; heading: string }> = {
  REGISTER: { subject: "Tu código de verificación NovaBank", heading: "Verifica tu cuenta" },
  PASSWORD_RESET: { subject: "Recupera tu contraseña de NovaBank", heading: "Recuperar contraseña" },
  TRANSFER: { subject: "Código para confirmar tu transferencia", heading: "Confirmar transferencia" },
};

async function requestOtp(email: string, purpose: OtpPurpose): Promise<void> {
  // Only the most recently requested code should ever be valid.
  await prisma.emailOtp.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  await prisma.emailOtp.create({
    data: {
      email,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const copy = EMAIL_COPY[purpose];
  await sendEmail(
    email,
    copy.subject,
    `<div style="font-family:sans-serif;max-width:420px">
       <h2 style="color:#133A63">NovaBank</h2>
       <p>${copy.heading} — tu código es:</p>
       <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#133A63">${code}</p>
       <p style="color:#666;font-size:13px">Vence en 10 minutos. Si no solicitaste esto, ignora este correo.</p>
     </div>`
  );
}

async function verifyOtp(email: string, code: string, purpose: OtpPurpose): Promise<void> {
  const otp = await prisma.emailOtp.findFirst({
    where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw new HttpError(400, "El código expiró o no es válido, solicita uno nuevo");
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    throw new HttpError(429, "Demasiados intentos, solicita un nuevo código");
  }

  if (hashCode(code) !== otp.codeHash) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: otp.attempts + 1 } });
    throw new HttpError(400, "Código incorrecto");
  }

  await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
}

export async function requestRegisterOtp(email: string): Promise<void> {
  await requestOtp(email, "REGISTER");
}

export async function verifyRegisterOtp(email: string, code: string): Promise<void> {
  await verifyOtp(email, code, "REGISTER");
}

export async function requestPasswordResetOtp(email: string): Promise<void> {
  await requestOtp(email, "PASSWORD_RESET");
}

export async function verifyPasswordResetOtp(email: string, code: string): Promise<void> {
  await verifyOtp(email, code, "PASSWORD_RESET");
}

export async function requestTransferOtp(email: string): Promise<void> {
  await requestOtp(email, "TRANSFER");
}

export async function verifyTransferOtp(email: string, code: string): Promise<void> {
  await verifyOtp(email, code, "TRANSFER");
}
