import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorObtenerCatalogo, manejadorListarRecibos, manejadorAfiliar, manejadorPagarRecibo, manejadorSuspenderServicio, manejadorReanudarServicio } from "./recibos.controlador";

export const billsRouter = Router();

billsRouter.get("/catalog", requireAuth, asyncHandler(manejadorObtenerCatalogo));
billsRouter.get("/", requireAuth, asyncHandler(manejadorListarRecibos));
billsRouter.post("/affiliate", requireAuth, asyncHandler(manejadorAfiliar));
billsRouter.post("/:id/pay", requireAuth, asyncHandler(manejadorPagarRecibo));
billsRouter.post("/:id/suspend", requireAuth, asyncHandler(manejadorSuspenderServicio));
billsRouter.post("/:id/resume", requireAuth, asyncHandler(manejadorReanudarServicio));
