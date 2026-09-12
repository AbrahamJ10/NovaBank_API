import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

// Reuse a single PrismaClient instance across hot reloads in dev.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ["error", "warn"] : ["query", "error", "warn"],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
