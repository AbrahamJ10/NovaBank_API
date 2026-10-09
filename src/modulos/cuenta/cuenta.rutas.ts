import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { profileLimiter } from "../../intermediarios/limiteTasa";
import { manejadorObtenerCuenta, manejadorBloqueoTarjeta, manejadorRevelarCvv } from "./cuenta.controlador";

export const accountRouter = Router();

accountRouter.get("/", requerirAutenticacion, asyncHandler(manejadorObtenerCuenta));
accountRouter.post("/card-block", requerirAutenticacion, asyncHandler(manejadorBloqueoTarjeta));
accountRouter.post("/reveal-cvv", requerirAutenticacion, profileLimiter, asyncHandler(manejadorRevelarCvv));
