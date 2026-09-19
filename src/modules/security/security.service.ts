import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { hashToken } from "../../lib/jwt";
import type { UpdateAlertsInput, UpdateLimitsInput } from "./security.validators";

export async function getAlerts(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { compra: user.alertPurchase, retiro: user.alertWithdraw, login: user.alertLogin, promo: user.alertPromo };
}

export async function updateAlerts(userId: string, input: UpdateAlertsInput) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      alertPurchase: input.compra,
      alertWithdraw: input.retiro,
      alertLogin: input.login,
      alertPromo: input.promo,
    },
  });
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

export async function updateLimits(userId: string, input: UpdateLimitsInput) {
  const updated = await prisma.account.update({
    where: { userId },
    data: {
      limitOnline: input.limitOnline,
      limitAtm: input.limitAtm,
      geoPeru: input.geoPeru,
      geoIntl: input.geoIntl,
    },
  });
  return {
    limitOnline: Number(updated.limitOnline),
    limitAtm: Number(updated.limitAtm),
    geoPeru: updated.geoPeru,
    geoIntl: updated.geoIntl,
  };
}

// A stored refresh token's userAgent is whatever the device sent at
// login/refresh time — shown as-is rather than parsed into a device model,
// since Expo's fetch userAgent is a generic engine string, not a real UA.
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

export async function revokeSession(userId: string, sessionId: string) {
  const session = await prisma.refreshToken.findFirst({ where: { id: sessionId, userId, revokedAt: null } });
  if (!session) throw new HttpError(404, "Sesión no encontrada");
  await prisma.refreshToken.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
}

export async function revokeOtherSessions(userId: string, currentRefreshToken: string) {
  const currentHash = hashToken(currentRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, tokenHash: { not: currentHash } },
    data: { revokedAt: new Date() },
  });
}
