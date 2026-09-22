import crypto from "crypto";
import { prisma } from "../../libreria/prisma";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";
import { enviarCorreo } from "./correo";
import type { OtpPurpose } from "@prisma/client";

// El registro es el único flujo donde el código se verifica bastante antes
// de completarse (justo al escribir el correo, mucho antes de terminar la
// captura de DNI/rostro) — los demás propósitos son confirmaciones
// inmediatas de una sola acción, así que se quedan con una ventana corta.
const OTP_TTL_MS: Record<OtpPurpose, number> = {
  REGISTER: 30 * 60 * 1000,
  PASSWORD_RESET: 10 * 60 * 1000,
  TRANSFER: 10 * 60 * 1000,
  PROFILE_UPDATE: 10 * 60 * 1000,
};

const MAX_INTENTOS = 5;

// Independiente de MAX_INTENTOS: ese límite es por código individual (pedir
// uno nuevo lo resetea), mientras que este cuenta intentos fallidos
// acumulados por correo+propósito sin importar cuántos códigos nuevos se
// hayan pedido mientras tanto, y bloquea la verificación por un tiempo en
// vez de solo exigir un código nuevo.
const MAX_INTENTOS_BLOQUEO = 4;
const DURACION_BLOQUEO_MS = 30 * 60 * 1000;

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

async function obtenerBloqueo(correo: string, proposito: OtpPurpose) {
  return prisma.bloqueoOtp.findUnique({ where: { correo_proposito: { correo, proposito } } });
}

async function registrarIntentoFallido(correo: string, proposito: OtpPurpose): Promise<void> {
  const bloqueo = await prisma.bloqueoOtp.upsert({
    where: { correo_proposito: { correo, proposito } },
    create: { correo, proposito, intentos: 1 },
    update: { intentos: { increment: 1 } },
  });

  if (bloqueo.intentos >= MAX_INTENTOS_BLOQUEO) {
    await prisma.bloqueoOtp.update({
      where: { correo_proposito: { correo, proposito } },
      data: { intentos: 0, bloqueadoHasta: new Date(Date.now() + DURACION_BLOQUEO_MS) },
    });
    throw new ErrorHttp(429, "Superaste el número de intentos permitidos. Vuelve a intentarlo en 30 minutos.");
  }
}

async function limpiarBloqueo(correo: string, proposito: OtpPurpose): Promise<void> {
  await prisma.bloqueoOtp.deleteMany({ where: { correo, proposito } });
}

async function solicitarOtp(correo: string, proposito: OtpPurpose): Promise<void> {
  const bloqueo = await obtenerBloqueo(correo, proposito);
  if (bloqueo?.bloqueadoHasta && bloqueo.bloqueadoHasta > new Date()) {
    const minutosRestantes = Math.ceil((bloqueo.bloqueadoHasta.getTime() - Date.now()) / 60000);
    throw new ErrorHttp(429, `Superaste el número de intentos permitidos. Vuelve a intentarlo en ${minutosRestantes} minutos.`);
  }

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
      expiresAt: new Date(Date.now() + OTP_TTL_MS[proposito]),
    },
  });

  const texto = TEXTO_CORREO[proposito];
  const minutosTtl = Math.round(OTP_TTL_MS[proposito] / 60000);
  await enviarCorreo(
    correo,
    texto.subject,
    `<div style="font-family:sans-serif;max-width:420px">
       <h2 style="color:#133A63">NovaBank</h2>
       <p>${texto.heading} — tu código es:</p>
       <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#133A63">${codigo}</p>
       <p style="color:#666;font-size:13px">Vence en ${minutosTtl} minutos. Si no solicitaste esto, ignora este correo.</p>
     </div>`
  );
}

// `consumir` en false deja el código intacto (no lo marca como usado) para
// que pueda revisarse otra vez más adelante — lo usa la verificación
// temprana del correo en el formulario de registro, que ocurre mucho antes
// de que el registro en sí se complete con ese mismo código.
async function verificarOtp(correo: string, codigo: string, proposito: OtpPurpose, consumir = true): Promise<void> {
  const bloqueo = await obtenerBloqueo(correo, proposito);
  if (bloqueo?.bloqueadoHasta && bloqueo.bloqueadoHasta > new Date()) {
    const minutosRestantes = Math.ceil((bloqueo.bloqueadoHasta.getTime() - Date.now()) / 60000);
    throw new ErrorHttp(429, `Superaste el número de intentos permitidos. Vuelve a intentarlo en ${minutosRestantes} minutos.`);
  }

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
    await registrarIntentoFallido(correo, proposito);
    throw new ErrorHttp(400, "Código incorrecto");
  }

  await limpiarBloqueo(correo, proposito);
  if (consumir) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  }
}

export async function solicitarOtpRegistro(correo: string): Promise<void> {
  await solicitarOtp(correo, "REGISTER");
}

export async function verificarOtpRegistro(correo: string, codigo: string): Promise<void> {
  await verificarOtp(correo, codigo, "REGISTER");
}

// Verificación temprana del correo en el formulario de registro — confirma
// que el código es correcto pero no lo consume, porque el registro en sí
// (mucho más adelante en el flujo, después de la foto del DNI y el rostro)
// vuelve a validar este mismo código con verificarOtpRegistro.
export async function verificarOtpRegistroPrevio(correo: string, codigo: string): Promise<void> {
  await verificarOtp(correo, codigo, "REGISTER", false);
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
