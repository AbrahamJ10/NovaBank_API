import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { manejadorObtenerCatalogo, manejadorListarRecibos, manejadorAfiliar, manejadorPagarRecibo, manejadorSuspenderServicio, manejadorReanudarServicio } from "./bills.controller";

export const billsRouter = Router();

billsRouter.get("/catalog", requireAuth, asyncHandler(manejadorObtenerCatalogo));
billsRouter.get("/", requireAuth, asyncHandler(manejadorListarRecibos));
billsRouter.post("/affiliate", requireAuth, asyncHandler(manejadorAfiliar));
billsRouter.post("/:id/pay", requireAuth, asyncHandler(manejadorPagarRecibo));
billsRouter.post("/:id/suspend", requireAuth, asyncHandler(manejadorSuspenderServicio));
billsRouter.post("/:id/resume", requireAuth, asyncHandler(manejadorReanudarServicio));
