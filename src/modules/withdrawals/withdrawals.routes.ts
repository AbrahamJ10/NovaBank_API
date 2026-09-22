import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { manejadorCrearRetiro, manejadorCancelarRetiro, manejadorRenovarRetiro } from "./withdrawals.controller";

export const withdrawalsRouter = Router();

withdrawalsRouter.post("/", requireAuth, asyncHandler(manejadorCrearRetiro));
withdrawalsRouter.post("/:id/cancel", requireAuth, asyncHandler(manejadorCancelarRetiro));
withdrawalsRouter.post("/:id/renew", requireAuth, asyncHandler(manejadorRenovarRetiro));
