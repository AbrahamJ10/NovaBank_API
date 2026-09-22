import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { passwordResetLimiter, profileLimiter } from "../../middleware/rateLimit";
import { manejadorSolicitarOtpPerfil, manejadorActualizarCorreo, manejadorActualizarContrasena, manejadorActualizarTelefono } from "./profile.controller";

export const profileRouter = Router();

// Reutiliza el mismo techo estricto de envío de correos que las solicitudes de restablecer contraseña.
profileRouter.post("/otp/request", requireAuth, passwordResetLimiter, asyncHandler(manejadorSolicitarOtpPerfil));
profileRouter.post("/email", requireAuth, profileLimiter, asyncHandler(manejadorActualizarCorreo));
profileRouter.post("/phone", requireAuth, profileLimiter, asyncHandler(manejadorActualizarTelefono));
profileRouter.post("/password", requireAuth, profileLimiter, asyncHandler(manejadorActualizarContrasena));
