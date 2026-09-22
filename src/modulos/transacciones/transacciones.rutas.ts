import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorListarTransacciones } from "./transacciones.controlador";

export const transactionsRouter = Router();

transactionsRouter.get("/", requerirAutenticacion, asyncHandler(manejadorListarTransacciones));
