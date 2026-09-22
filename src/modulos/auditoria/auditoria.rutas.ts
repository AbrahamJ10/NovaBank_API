import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { auditLimiter } from "../../intermediarios/limiteTasa";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorRegistrarEventos } from "./auditoria.controlador";

export const auditRouter = Router();

auditRouter.post("/events", requireAuth, auditLimiter, asyncHandler(manejadorRegistrarEventos));
