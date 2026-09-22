import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { passwordResetLimiter, profileLimiter } from "../../intermediarios/limiteTasa";
import { manejadorSolicitarOtpPerfil, manejadorActualizarCorreo, manejadorActualizarContrasena, manejadorActualizarTelefono } from "./perfil.controlador";

export const profileRouter = Router();

// Reutiliza el mismo techo estricto de envío de correos que las solicitudes de restablecer contraseña.
profileRouter.post("/otp/request", requerirAutenticacion, passwordResetLimiter, asyncHandler(manejadorSolicitarOtpPerfil));
profileRouter.post("/email", requerirAutenticacion, profileLimiter, asyncHandler(manejadorActualizarCorreo));
profileRouter.post("/phone", requerirAutenticacion, profileLimiter, asyncHandler(manejadorActualizarTelefono));
profileRouter.post("/password", requerirAutenticacion, profileLimiter, asyncHandler(manejadorActualizarContrasena));
