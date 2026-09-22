import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorCrearBeneficiario, manejadorListarBeneficiarios } from "./destinatarios.controlador";

export const payeesRouter = Router();

payeesRouter.get("/", requerirAutenticacion, asyncHandler(manejadorListarBeneficiarios));
payeesRouter.post("/", requerirAutenticacion, asyncHandler(manejadorCrearBeneficiario));
