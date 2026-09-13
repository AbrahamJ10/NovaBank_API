import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { sendEmail } from "./email";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestRegisterOtp(email: string): Promise<void> {
  // Only the most recently requested code should ever be valid.
  await prisma.emailOtp.updateMany({
    where: { email, purpose: "REGISTER", consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  await prisma.emailOtp.create({
    data: {
      email,
      purpose: "REGISTER",
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await sendEmail(
    email,
    "Tu código de verificación NovaBank",
    `<div style="font-family:sans-serif;max-width:420px">
       <h2 style="color:#133A63">NovaBank</h2>
       <p>Tu código de verificación es:</p>
       <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#133A63">${code}</p>
       <p style="color:#666;font-size:13px">Vence en 10 minutos. Si no solicitaste esto, ignora este correo.</p>
     </div>`
  );
}

export async function verifyRegisterOtp(email: string, code: string): Promise<void> {
  const otp = await prisma.emailOtp.findFirst({
    where: { email, purpose: "REGISTER", consumedAt: null, expiresAt: { gt: new Date() } },
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
