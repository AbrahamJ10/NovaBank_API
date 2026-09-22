import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorCrearBeneficiario, manejadorListarBeneficiarios } from "./destinatarios.controlador";

export const payeesRouter = Router();

payeesRouter.get("/", requireAuth, asyncHandler(manejadorListarBeneficiarios));
payeesRouter.post("/", requireAuth, asyncHandler(manejadorCrearBeneficiario));
