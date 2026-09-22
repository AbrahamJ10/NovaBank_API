import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { statementLimiter } from "../../intermediarios/limiteTasa";
import { manejadorEnviarEstadoCuenta } from "./estadosCuenta.controlador";

export const statementsRouter = Router();

statementsRouter.post("/send", requireAuth, statementLimiter, asyncHandler(manejadorEnviarEstadoCuenta));
