import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorObtenerCatalogo, manejadorListarRecibos, manejadorAfiliar, manejadorPagarRecibo, manejadorSuspenderServicio, manejadorReanudarServicio } from "./recibos.controlador";

export const billsRouter = Router();

billsRouter.get("/catalog", requerirAutenticacion, asyncHandler(manejadorObtenerCatalogo));
billsRouter.get("/", requerirAutenticacion, asyncHandler(manejadorListarRecibos));
billsRouter.post("/affiliate", requerirAutenticacion, asyncHandler(manejadorAfiliar));
billsRouter.post("/:id/pay", requerirAutenticacion, asyncHandler(manejadorPagarRecibo));
billsRouter.post("/:id/suspend", requerirAutenticacion, asyncHandler(manejadorSuspenderServicio));
billsRouter.post("/:id/resume", requerirAutenticacion, asyncHandler(manejadorReanudarServicio));
