import { prisma } from "../../libreria/prisma";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";
import { hashearToken } from "../../libreria/jwt";
import type { EntradaActualizarAlertas, EntradaActualizarLimites } from "./seguridad.validadores";
import { registrarAuditoria } from "../auditoria/auditoria.servicio";
import type { MetaSolicitud } from "../../libreria/metaSolicitud";

export async function obtenerAlertas(idUsuario: string) {
  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: idUsuario } });
  return { compra: usuario.alertPurchase, retiro: usuario.alertWithdraw, login: usuario.alertLogin, promo: usuario.alertPromo };
}

export async function actualizarAlertas(idUsuario: string, entrada: EntradaActualizarAlertas, metaSolicitud?: MetaSolicitud) {
  const actualizado = await prisma.user.update({
    where: { id: idUsuario },
    data: {
      alertPurchase: entrada.compra,
      alertWithdraw: entrada.retiro,
      alertLogin: entrada.login,
      alertPromo: entrada.promo,
    },
  });
  await registrarAuditoria({ userId: idUsuario, category: "SEGURIDAD", action: "alerts_updated", metadata: { ...entrada }, meta: metaSolicitud });
  return { compra: actualizado.alertPurchase, retiro: actualizado.alertWithdraw, login: actualizado.alertLogin, promo: actualizado.alertPromo };
}

export async function obtenerLimites(idUsuario: string) {
  const cuenta = await prisma.account.findUniqueOrThrow({ where: { userId: idUsuario } });
  return {
    limitOnline: Number(cuenta.limitOnline),
    limitAtm: Number(cuenta.limitAtm),
    geoPeru: cuenta.geoPeru,
    geoIntl: cuenta.geoIntl,
  };
}

export async function actualizarLimites(idUsuario: string, entrada: EntradaActualizarLimites, metaSolicitud?: MetaSolicitud) {
  const actualizada = await prisma.account.update({
    where: { userId: idUsuario },
    data: {
      limitOnline: entrada.limitOnline,
      limitAtm: entrada.limitAtm,
      geoPeru: entrada.geoPeru,
      geoIntl: entrada.geoIntl,
    },
  });
  await registrarAuditoria({ userId: idUsuario, category: "SEGURIDAD", action: "limits_updated", metadata: { ...entrada }, meta: metaSolicitud });
  return {
    limitOnline: Number(actualizada.limitOnline),
    limitAtm: Number(actualizada.limitAtm),
    geoPeru: actualizada.geoPeru,
    geoIntl: actualizada.geoIntl,
  };
}

// El userAgent guardado de un refresh token es lo que el dispositivo haya
// enviado al momento del login/refresh — se muestra tal cual en vez de
// interpretarlo como un modelo de dispositivo, ya que el userAgent del
// fetch de Expo es un string genérico del motor, no un user-agent real.
function describirDispositivo(userAgent: string | null): string {
  return userAgent && userAgent.trim().length > 0 ? userAgent : "Dispositivo desconocido";
}

export async function listarSesiones(idUsuario: string, refreshTokenActual?: string) {
  const hashActual = refreshTokenActual ? hashearToken(refreshTokenActual) : null;
  const sesiones = await prisma.refreshToken.findMany({
    where: { userId: idUsuario, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return sesiones.map((s) => ({
    id: s.id,
    device: describirDispositivo(s.userAgent),
    ip: s.ip,
    createdAt: s.createdAt,
    current: hashActual !== null && hashActual === s.tokenHash,
  }));
}

export async function revocarSesion(idUsuario: string, idSesion: string, metaSolicitud?: MetaSolicitud) {
  const sesion = await prisma.refreshToken.findFirst({ where: { id: idSesion, userId: idUsuario, revokedAt: null } });
  if (!sesion) throw new ErrorHttp(404, "Sesión no encontrada");
  await prisma.refreshToken.update({ where: { id: sesion.id }, data: { revokedAt: new Date() } });
  await registrarAuditoria({
    userId: idUsuario,
    category: "SESION",
    action: "session_revoked",
    metadata: { sessionId: idSesion, device: describirDispositivo(sesion.userAgent), ip: sesion.ip },
    meta: metaSolicitud,
  });
}

export async function revocarOtrasSesiones(idUsuario: string, refreshTokenActual: string, metaSolicitud?: MetaSolicitud) {
  const hashActual = hashearToken(refreshTokenActual);
  const resultado = await prisma.refreshToken.updateMany({
    where: { userId: idUsuario, revokedAt: null, tokenHash: { not: hashActual } },
    data: { revokedAt: new Date() },
  });
  await registrarAuditoria({
    userId: idUsuario,
    category: "SESION",
    action: "sessions_revoked_others",
    metadata: { count: resultado.count },
    meta: metaSolicitud,
  });
}
