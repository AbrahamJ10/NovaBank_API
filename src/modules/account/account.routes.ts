import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { profileLimiter } from "../../middleware/rateLimit";
import { manejadorObtenerCuenta, manejadorBloqueoTarjeta, manejadorPagoTarjeta, manejadorRevelarCvv } from "./account.controller";

export const accountRouter = Router();

accountRouter.get("/", requireAuth, asyncHandler(manejadorObtenerCuenta));
accountRouter.post("/card-block", requireAuth, asyncHandler(manejadorBloqueoTarjeta));
accountRouter.post("/pay-card", requireAuth, asyncHandler(manejadorPagoTarjeta));
accountRouter.post("/reveal-cvv", requireAuth, profileLimiter, asyncHandler(manejadorRevelarCvv));
