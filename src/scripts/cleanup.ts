import { prisma } from "../lib/prisma";

// Token rotation (a new refresh token on every /api/auth/refresh call) and
// short-lived OTPs both leave behind rows that are permanently useless
// within minutes — this prunes that accumulation on a schedule (see
// .github/workflows/cleanup.yml) instead of letting these tables grow
// forever. Nothing here touches a row that could still be used for
// anything: revoked/expired tokens can't authenticate, expired OTPs can't
// be verified, and login events are kept for a real audit-trail window.
const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  const now = new Date();

  const staleTokens = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { revokedAt: { lt: new Date(now.getTime() - 30 * DAY_MS) } },
        { expiresAt: { lt: new Date(now.getTime() - 30 * DAY_MS) } },
      ],
    },
  });

  const staleOtps = await prisma.emailOtp.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - 7 * DAY_MS) } },
  });

  const staleLogins = await prisma.loginEvent.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 180 * DAY_MS) } },
  });

  console.log(
    `Cleanup: removed ${staleTokens.count} refresh tokens, ${staleOtps.count} OTP codes, ${staleLogins.count} login events.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
