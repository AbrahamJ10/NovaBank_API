import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorListarTransacciones } from "./transacciones.controlador";

export const transactionsRouter = Router();

transactionsRouter.get("/", requireAuth, asyncHandler(manejadorListarTransacciones));
