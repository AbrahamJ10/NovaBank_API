import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { hashToken } from "../../lib/jwt";
import type { UpdateAlertsInput, UpdateLimitsInput } from "./security.validators";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

export async function getAlerts(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { compra: user.alertPurchase, retiro: user.alertWithdraw, login: user.alertLogin, promo: user.alertPromo };
}

export async function updateAlerts(userId: string, input: UpdateAlertsInput, meta?: RequestMeta) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      alertPurchase: input.compra,
      alertWithdraw: input.retiro,
      alertLogin: input.login,
      alertPromo: input.promo,
    },
  });
  await recordAudit({ userId, category: "SEGURIDAD", action: "alerts_updated", metadata: { ...input }, meta });
  return { compra: updated.alertPurchase, retiro: updated.alertWithdraw, login: updated.alertLogin, promo: updated.alertPromo };
}

export async function getLimits(userId: string) {
  const account = await prisma.account.findUniqueOrThrow({ where: { userId } });
  return {
    limitOnline: Number(account.limitOnline),
    limitAtm: Number(account.limitAtm),
    geoPeru: account.geoPeru,
    geoIntl: account.geoIntl,
  };
}

export async function updateLimits(userId: string, input: UpdateLimitsInput, meta?: RequestMeta) {
  const updated = await prisma.account.update({
    where: { userId },
    data: {
      limitOnline: input.limitOnline,
      limitAtm: input.limitAtm,
      geoPeru: input.geoPeru,
      geoIntl: input.geoIntl,
    },
  });
  await recordAudit({ userId, category: "SEGURIDAD", action: "limits_updated", metadata: { ...input }, meta });
  return {
    limitOnline: Number(updated.limitOnline),
    limitAtm: Number(updated.limitAtm),
    geoPeru: updated.geoPeru,
    geoIntl: updated.geoIntl,
  };
}

// El userAgent guardado de un refresh token es lo que el dispositivo haya
// enviado al momento del login/refresh — se muestra tal cual en vez de
// interpretarlo como un modelo de dispositivo, ya que el userAgent del
// fetch de Expo es un string genérico del motor, no un user-agent real.
function describeDevice(userAgent: string | null): string {
  return userAgent && userAgent.trim().length > 0 ? userAgent : "Dispositivo desconocido";
}

export async function listSessions(userId: string, currentRefreshToken?: string) {
  const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;
  const sessions = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return sessions.map((s) => ({
    id: s.id,
    device: describeDevice(s.userAgent),
    ip: s.ip,
    createdAt: s.createdAt,
    current: currentHash !== null && currentHash === s.tokenHash,
  }));
}

export async function revokeSession(userId: string, sessionId: string, meta?: RequestMeta) {
  const session = await prisma.refreshToken.findFirst({ where: { id: sessionId, userId, revokedAt: null } });
  if (!session) throw new HttpError(404, "Sesión no encontrada");
  await prisma.refreshToken.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  await recordAudit({
    userId,
    category: "SESION",
    action: "session_revoked",
    metadata: { sessionId, device: describeDevice(session.userAgent), ip: session.ip },
    meta,
  });
}

export async function revokeOtherSessions(userId: string, currentRefreshToken: string, meta?: RequestMeta) {
  const currentHash = hashToken(currentRefreshToken);
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, tokenHash: { not: currentHash } },
    data: { revokedAt: new Date() },
  });
  await recordAudit({
    userId,
    category: "SESION",
    action: "sessions_revoked_others",
    metadata: { count: result.count },
    meta,
  });
}
