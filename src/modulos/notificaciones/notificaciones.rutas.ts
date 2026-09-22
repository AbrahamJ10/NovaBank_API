import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { manejadorEliminarTodas, manejadorListarNotificaciones, manejadorMarcarTodasLeidas, manejadorMarcarLeida } from "./notificaciones.controlador";

export const notificationsRouter = Router();

notificationsRouter.get("/", requerirAutenticacion, asyncHandler(manejadorListarNotificaciones));
notificationsRouter.post("/read-all", requerirAutenticacion, asyncHandler(manejadorMarcarTodasLeidas));
notificationsRouter.post("/:id/read", requerirAutenticacion, asyncHandler(manejadorMarcarLeida));
notificationsRouter.delete("/", requerirAutenticacion, asyncHandler(manejadorEliminarTodas));
