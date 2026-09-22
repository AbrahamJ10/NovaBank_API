import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorPagoQr } from "./qr.controlador";

export const qrRouter = Router();

qrRouter.post("/pay", requerirAutenticacion, asyncHandler(manejadorPagoQr));
