import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { passwordResetLimiter, profileLimiter } from "../../intermediarios/limiteTasa";
import { manejadorSolicitarOtpPerfil, manejadorActualizarCorreo, manejadorActualizarContrasena, manejadorActualizarTelefono } from "./perfil.controlador";

export const profileRouter = Router();

// Reutiliza el mismo techo estricto de envío de correos que las solicitudes de restablecer contraseña.
profileRouter.post("/otp/request", requireAuth, passwordResetLimiter, asyncHandler(manejadorSolicitarOtpPerfil));
profileRouter.post("/email", requireAuth, profileLimiter, asyncHandler(manejadorActualizarCorreo));
profileRouter.post("/phone", requireAuth, profileLimiter, asyncHandler(manejadorActualizarTelefono));
profileRouter.post("/password", requireAuth, profileLimiter, asyncHandler(manejadorActualizarContrasena));
