import crypto from "crypto";
import { prisma } from "../../libreria/prisma";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";
import { enviarCorreo } from "./correo";
import { env } from "../../configuracion/entorno";
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
  await enviarCorreo(correo, texto.subject, plantillaCorreoOtp(texto.heading, codigo, minutosTtl));
}

// Correo transaccional del código — tabla con estilos inline (el estándar
// para HTML de correo, ya que la mayoría de clientes ignoran hojas de
// estilo externas o incluso etiquetas <style>). El logo va por URL pública
// (servida por esta misma API en /assets) en vez de incrustado en base64:
// Gmail bloquea las imágenes data: en el cuerpo del correo y las muestra
// rotas, pero sí carga imágenes de una URL externa normal.
function plantillaCorreoOtp(heading: string, codigo: string, minutosTtl: number): string {
  const logoUrl = `${env.publicBaseUrl}/assets/logo-banco.png`;
  const digitos = codigo
    .split("")
    .map(
      (d) =>
        `<td style="width:40px;height:52px;background:#F8FAFC;border:1px solid #E4E9F0;border-bottom:3px solid #C9A227;border-radius:10px;font:700 24px/52px Helvetica,Arial,sans-serif;color:#133A63;text-align:center;">${d}</td>`
    )
    .join(`<td style="width:8px;"></td>`);

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F6;padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="460" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;max-width:460px;box-shadow:0 2px 10px rgba(19,58,99,.06);">
        <tr>
          <td style="background:#133A63;height:5px;line-height:5px;font-size:0;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center" style="padding:32px 32px 22px;">
            <img src="${logoUrl}" width="120" alt="NovaBank" style="display:block;height:auto;border:0;" />
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px;font:700 21px/1.3 Helvetica,Arial,sans-serif;color:#0F1A26;">${heading}</td>
        </tr>
        <tr>
          <td align="center" style="padding:8px 32px 28px;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#5B6B7C;">Usa este código para continuar. Es válido solo para ti.</td>
        </tr>
        <tr>
          <td align="center" style="padding:0 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>${digitos}</tr></table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 32px 0;">
            <span style="display:inline-block;padding:5px 14px;background:#F8FAFC;border-radius:20px;font:600 12px/1.4 Helvetica,Arial,sans-serif;color:#8A97A6;">Vence en ${minutosTtl} minutos</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 24px;">
            <div style="height:1px;background:#EEF1F5;"></div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 32px;font:400 12px/1.5 Helvetica,Arial,sans-serif;color:#A7B1BD;">Si no solicitaste este código, ignora este correo — tu cuenta sigue segura.</td>
        </tr>
      </table>
      <p style="margin:22px 0 0;font:400 11px/1.4 Helvetica,Arial,sans-serif;color:#A7B1BD;">© NovaBank</p>
    </td>
  </tr>
</table>`;
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
