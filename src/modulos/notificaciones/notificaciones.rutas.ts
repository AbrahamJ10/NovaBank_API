import { Router } from "express";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorEliminarTodas, manejadorListarNotificaciones, manejadorMarcarTodasLeidas, manejadorMarcarLeida } from "./notificaciones.controlador";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, asyncHandler(manejadorListarNotificaciones));
notificationsRouter.post("/read-all", requireAuth, asyncHandler(manejadorMarcarTodasLeidas));
notificationsRouter.post("/:id/read", requireAuth, asyncHandler(manejadorMarcarLeida));
notificationsRouter.delete("/", requireAuth, asyncHandler(manejadorEliminarTodas));
