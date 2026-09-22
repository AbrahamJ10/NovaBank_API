import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { auditLimiter } from "../../intermediarios/limiteTasa";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorRegistrarEventos } from "./auditoria.controlador";

export const auditRouter = Router();

auditRouter.post("/events", requerirAutenticacion, auditLimiter, asyncHandler(manejadorRegistrarEventos));
