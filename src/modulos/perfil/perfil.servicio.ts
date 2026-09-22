import bcrypt from "bcryptjs";
import { prisma } from "../../libreria/prisma";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";
import { solicitarOtpPerfil as enviarOtpPerfil, verificarOtpPerfil } from "../verificacion/otp.servicio";
import type { EntradaActualizarCorreo, EntradaActualizarContrasena, EntradaActualizarTelefono } from "./perfil.validadores";
import { registrarAuditoria } from "../auditoria/auditoria.servicio";
import type { MetaSolicitud } from "../../libreria/metaSolicitud";

const RONDAS_SAL_CONTRASENA = 12;

function aUsuarioPublico(usuario: { id: string; email: string; fullName: string; phone: string | null; dni: string | null }) {
  return { id: usuario.id, email: usuario.email, fullName: usuario.fullName, phone: usuario.phone, dni: usuario.dni };
}

// Todo cambio de perfil (correo/teléfono/contraseña) se confirma con un
// código enviado al correo ACTUAL verificado de la cuenta — prueba que
// quien hace el cambio controla la cuenta ya registrada, sin importar cuál
// campo esté cambiando.
export async function solicitarOtpPerfil(idUsuario: string): Promise<void> {
  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: idUsuario } });
  await enviarOtpPerfil(usuario.email);
}

export async function actualizarCorreo(idUsuario: string, entrada: EntradaActualizarCorreo, metaSolicitud?: MetaSolicitud) {
  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: idUsuario } });

  if (entrada.newEmail === usuario.email) {
    throw new ErrorHttp(400, "Ese ya es tu correo actual");
  }

  const enUso = await prisma.user.findUnique({ where: { email: entrada.newEmail } });
  if (enUso) {
    throw new ErrorHttp(409, "Ese correo ya está en uso por otra cuenta");
  }

  await verificarOtpPerfil(usuario.email, entrada.otpCode);

  const actualizado = await prisma.user.update({ where: { id: idUsuario }, data: { email: entrada.newEmail } });
  await registrarAuditoria({
    userId: idUsuario,
    category: "PERFIL",
    action: "email_updated",
    metadata: { previousEmail: usuario.email, newEmail: entrada.newEmail },
    meta: metaSolicitud,
  });
  return aUsuarioPublico(actualizado);
}

export async function actualizarTelefono(idUsuario: string, entrada: EntradaActualizarTelefono, metaSolicitud?: MetaSolicitud) {
  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: idUsuario } });

  if (entrada.newPhone === usuario.phone) {
    throw new ErrorHttp(400, "Ese ya es tu número actual");
  }

  const enUso = await prisma.user.findUnique({ where: { phone: entrada.newPhone } });
  if (enUso) {
    throw new ErrorHttp(409, "Ese número ya está en uso por otra cuenta");
  }

  await verificarOtpPerfil(usuario.email, entrada.otpCode);

  const actualizado = await prisma.user.update({ where: { id: idUsuario }, data: { phone: entrada.newPhone } });
  await registrarAuditoria({
    userId: idUsuario,
    category: "PERFIL",
    action: "phone_updated",
    metadata: { previousPhone: usuario.phone, newPhone: entrada.newPhone },
    meta: metaSolicitud,
  });
  return aUsuarioPublico(actualizado);
}

export async function actualizarContrasena(idUsuario: string, entrada: EntradaActualizarContrasena, metaSolicitud?: MetaSolicitud): Promise<void> {
  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: idUsuario } });

  const coincide = await bcrypt.compare(entrada.currentPassword, usuario.passwordHash);
  if (!coincide) {
    await registrarAuditoria({ userId: idUsuario, category: "PERFIL", action: "password_update_failed_wrong_current", success: false, meta: metaSolicitud });
    throw new ErrorHttp(401, "Tu contraseña actual no es correcta");
  }

  await verificarOtpPerfil(usuario.email, entrada.otpCode);

  const hashContrasena = await bcrypt.hash(entrada.newPassword, RONDAS_SAL_CONTRASENA);
  await prisma.user.update({ where: { id: idUsuario }, data: { passwordHash: hashContrasena } });
  await registrarAuditoria({ userId: idUsuario, category: "PERFIL", action: "password_updated", meta: metaSolicitud });
}
