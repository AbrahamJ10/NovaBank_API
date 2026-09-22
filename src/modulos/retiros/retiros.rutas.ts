import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorCrearRetiro, manejadorCancelarRetiro, manejadorRenovarRetiro } from "./retiros.controlador";

export const withdrawalsRouter = Router();

withdrawalsRouter.post("/", requerirAutenticacion, asyncHandler(manejadorCrearRetiro));
withdrawalsRouter.post("/:id/cancel", requerirAutenticacion, asyncHandler(manejadorCancelarRetiro));
withdrawalsRouter.post("/:id/renew", requerirAutenticacion, asyncHandler(manejadorRenovarRetiro));
