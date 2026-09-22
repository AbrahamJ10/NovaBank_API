import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const healthRouter = Router();

healthRouter.get("/health", (_peticion, respuesta) => {
  respuesta.json({ status: "ok" });
});

healthRouter.get(
  "/health/db",
  asyncHandler(async (_peticion, respuesta) => {
    await prisma.$queryRaw`SELECT 1`;
    respuesta.json({ status: "ok", db: "connected" });
  })
);
