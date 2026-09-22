import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { auditLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../lib/asyncHandler";
import { manejadorRegistrarEventos } from "./audit.controller";

export const auditRouter = Router();

auditRouter.post("/events", requireAuth, auditLimiter, asyncHandler(manejadorRegistrarEventos));
