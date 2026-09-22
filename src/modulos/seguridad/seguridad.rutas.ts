import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import {
  manejadorObtenerAlertas,
  manejadorActualizarAlertas,
  manejadorObtenerLimites,
  manejadorActualizarLimites,
  manejadorListarSesiones,
  manejadorRevocarSesion,
  manejadorRevocarOtrasSesiones,
} from "./seguridad.controlador";

export const securityRouter = Router();

securityRouter.get("/alerts", requerirAutenticacion, asyncHandler(manejadorObtenerAlertas));
securityRouter.put("/alerts", requerirAutenticacion, asyncHandler(manejadorActualizarAlertas));
securityRouter.get("/limits", requerirAutenticacion, asyncHandler(manejadorObtenerLimites));
securityRouter.put("/limits", requerirAutenticacion, asyncHandler(manejadorActualizarLimites));
securityRouter.post("/sessions", requerirAutenticacion, asyncHandler(manejadorListarSesiones));
securityRouter.delete("/sessions/:id", requerirAutenticacion, asyncHandler(manejadorRevocarSesion));
securityRouter.post("/sessions/revoke-others", requerirAutenticacion, asyncHandler(manejadorRevocarOtrasSesiones));
