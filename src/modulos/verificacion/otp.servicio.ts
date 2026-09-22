import crypto from "crypto";
import { prisma } from "../../libreria/prisma";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";
import { enviarCorreo } from "./correo";
import type { OtpPurpose } from "@prisma/client";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 5;

function hashDeCodigo(codigo: string) {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

function generarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const TEXTO_CORREO: Record<OtpPurpose, { subject: string; heading: string }> = {
  REGISTER: { subject: "Tu código de verificación NovaBank", heading: "Verifica tu cuenta" },
  PASSWORD_RESET: { subject: "Recupera tu contraseña de NovaBank", heading: "Recuperar contraseña" },
  TRANSFER: { subject: "Código para confirmar tu transferencia", heading: "Confirmar transferencia" },
  PROFILE_UPDATE: { subject: "Código para confirmar tu cambio de datos", heading: "Confirmar cambio de datos" },
};

async function solicitarOtp(correo: string, proposito: OtpPurpose): Promise<void> {
  // Solo el código solicitado más recientemente debe ser válido.
  await prisma.emailOtp.updateMany({
    where: { email: correo, purpose: proposito, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const codigo = generarCodigo();
  await prisma.emailOtp.create({
    data: {
      email: correo,
      purpose: proposito,
      codeHash: hashDeCodigo(codigo),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const texto = TEXTO_CORREO[proposito];
  await enviarCorreo(
    correo,
    texto.subject,
    `<div style="font-family:sans-serif;max-width:420px">
       <h2 style="color:#133A63">NovaBank</h2>
       <p>${texto.heading} — tu código es:</p>
       <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#133A63">${codigo}</p>
       <p style="color:#666;font-size:13px">Vence en 10 minutos. Si no solicitaste esto, ignora este correo.</p>
     </div>`
  );
}

async function verificarOtp(correo: string, codigo: string, proposito: OtpPurpose): Promise<void> {
  const otp = await prisma.emailOtp.findFirst({
    where: { email: correo, purpose: proposito, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw new ErrorHttp(400, "El código expiró o no es válido, solicita uno nuevo");
  }

  if (otp.attempts >= MAX_INTENTOS) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    throw new ErrorHttp(429, "Demasiados intentos, solicita un nuevo código");
  }

  if (hashDeCodigo(codigo) !== otp.codeHash) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: otp.attempts + 1 } });
    throw new ErrorHttp(400, "Código incorrecto");
  }

  await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
}

export async function solicitarOtpRegistro(correo: string): Promise<void> {
  await solicitarOtp(correo, "REGISTER");
}

export async function verificarOtpRegistro(correo: string, codigo: string): Promise<void> {
  await verificarOtp(correo, codigo, "REGISTER");
}

export async function solicitarOtpRestablecerContrasena(correo: string): Promise<void> {
  await solicitarOtp(correo, "PASSWORD_RESET");
}

export async function verificarOtpRestablecerContrasena(correo: string, codigo: string): Promise<void> {
  await verificarOtp(correo, codigo, "PASSWORD_RESET");
}

export async function solicitarOtpTransferencia(correo: string): Promise<void> {
  await solicitarOtp(correo, "TRANSFER");
}

export async function verificarOtpTransferencia(correo: string, codigo: string): Promise<void> {
  await verificarOtp(correo, codigo, "TRANSFER");
}

export async function solicitarOtpPerfil(correo: string): Promise<void> {
  await solicitarOtp(correo, "PROFILE_UPDATE");
}

export async function verificarOtpPerfil(correo: string, codigo: string): Promise<void> {
  await verificarOtp(correo, codigo, "PROFILE_UPDATE");
}
