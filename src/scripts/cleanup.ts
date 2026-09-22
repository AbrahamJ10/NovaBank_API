import { prisma } from "../lib/prisma";

// La rotación de tokens (un refresh token nuevo en cada llamada a
// /api/auth/refresh) y los OTPs de corta duración dejan atrás filas que
// quedan permanentemente inútiles en minutos — esto poda esa acumulación
// con un horario (ver .github/workflows/cleanup.yml) en vez de dejar que
// estas tablas crezcan para siempre. Nada de esto toca una fila que aún
// pudiera servir para algo: los tokens revocados/expirados no pueden
// autenticar, los OTPs expirados no se pueden verificar, y los eventos de
// login se conservan durante una ventana real de auditoría.
const DIA_MS = 24 * 60 * 60 * 1000;

async function main() {
  const ahora = new Date();

  const tokensVencidos = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { revokedAt: { lt: new Date(ahora.getTime() - 30 * DIA_MS) } },
        { expiresAt: { lt: new Date(ahora.getTime() - 30 * DIA_MS) } },
      ],
    },
  });

  const otpsVencidos = await prisma.emailOtp.deleteMany({
    where: { expiresAt: { lt: new Date(ahora.getTime() - 7 * DIA_MS) } },
  });

  const loginsVencidos = await prisma.loginEvent.deleteMany({
    where: { createdAt: { lt: new Date(ahora.getTime() - 180 * DIA_MS) } },
  });

  console.log(
    `Limpieza: se eliminaron ${tokensVencidos.count} refresh tokens, ${otpsVencidos.count} códigos OTP, ${loginsVencidos.count} eventos de login.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
