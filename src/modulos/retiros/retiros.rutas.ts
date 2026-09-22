import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorCrearRetiro, manejadorCancelarRetiro, manejadorRenovarRetiro } from "./retiros.controlador";

export const withdrawalsRouter = Router();

withdrawalsRouter.post("/", requireAuth, asyncHandler(manejadorCrearRetiro));
withdrawalsRouter.post("/:id/cancel", requireAuth, asyncHandler(manejadorCancelarRetiro));
withdrawalsRouter.post("/:id/renew", requireAuth, asyncHandler(manejadorRenovarRetiro));
