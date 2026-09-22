import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { profileLimiter } from "../../intermediarios/limiteTasa";
import { manejadorObtenerCuenta, manejadorBloqueoTarjeta, manejadorPagoTarjeta, manejadorRevelarCvv } from "./cuenta.controlador";

export const accountRouter = Router();

accountRouter.get("/", requireAuth, asyncHandler(manejadorObtenerCuenta));
accountRouter.post("/card-block", requireAuth, asyncHandler(manejadorBloqueoTarjeta));
accountRouter.post("/pay-card", requireAuth, asyncHandler(manejadorPagoTarjeta));
accountRouter.post("/reveal-cvv", requireAuth, profileLimiter, asyncHandler(manejadorRevelarCvv));
