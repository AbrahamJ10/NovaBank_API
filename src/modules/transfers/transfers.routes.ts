import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { passwordResetLimiter, transferLimiter } from "../../middleware/rateLimit";
import { manejadorEjecutarTransferencia, manejadorSolicitarOtpTransferencia } from "./transfers.controller";

export const transfersRouter = Router();

// Reutiliza el mismo techo estricto de envío de correos que las solicitudes de restablecer contraseña.
transfersRouter.post("/otp/request", requireAuth, passwordResetLimiter, asyncHandler(manejadorSolicitarOtpTransferencia));
transfersRouter.post("/", requireAuth, transferLimiter, asyncHandler(manejadorEjecutarTransferencia));
