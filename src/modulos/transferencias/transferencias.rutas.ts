import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { passwordResetLimiter, transferLimiter } from "../../intermediarios/limiteTasa";
import { manejadorEjecutarTransferencia, manejadorSolicitarOtpTransferencia } from "./transferencias.controlador";

export const transfersRouter = Router();

// Reutiliza el mismo techo estricto de envío de correos que las solicitudes de restablecer contraseña.
transfersRouter.post("/otp/request", requireAuth, passwordResetLimiter, asyncHandler(manejadorSolicitarOtpTransferencia));
transfersRouter.post("/", requireAuth, transferLimiter, asyncHandler(manejadorEjecutarTransferencia));
