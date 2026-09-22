import { PrismaClient } from "@prisma/client";
import { env } from "../configuracion/entorno";

// Reutiliza una sola instancia de PrismaClient entre recargas en caliente en desarrollo.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ["error", "warn"] : ["query", "error", "warn"],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
