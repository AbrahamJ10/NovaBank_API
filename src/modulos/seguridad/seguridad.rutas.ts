import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
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

securityRouter.get("/alerts", requireAuth, asyncHandler(manejadorObtenerAlertas));
securityRouter.put("/alerts", requireAuth, asyncHandler(manejadorActualizarAlertas));
securityRouter.get("/limits", requireAuth, asyncHandler(manejadorObtenerLimites));
securityRouter.put("/limits", requireAuth, asyncHandler(manejadorActualizarLimites));
securityRouter.post("/sessions", requireAuth, asyncHandler(manejadorListarSesiones));
securityRouter.delete("/sessions/:id", requireAuth, asyncHandler(manejadorRevocarSesion));
securityRouter.post("/sessions/revoke-others", requireAuth, asyncHandler(manejadorRevocarOtrasSesiones));
