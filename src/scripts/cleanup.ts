import { prisma } from "../lib/prisma";

// La rotación de tokens (un refresh token nuevo en cada llamada a
// /api/auth/refresh) y los OTPs de corta duración dejan atrás filas que
// quedan permanentemente inútiles en minutos — esto poda esa acumulación
// con un horario (ver .github/workflows/cleanup.yml) en vez de dejar que
// estas tablas crezcan para siempre. Nada de esto toca una fila que aún
// pudiera servir para algo: los tokens revocados/expirados no pueden
// autenticar, los OTPs expirados no se pueden verificar, y los eventos de
// login se conservan durante una ventana real de auditoría.
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
