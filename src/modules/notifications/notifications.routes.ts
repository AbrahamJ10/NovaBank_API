import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { manejadorEliminarTodas, manejadorListarNotificaciones, manejadorMarcarTodasLeidas, manejadorMarcarLeida } from "./notifications.controller";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, asyncHandler(manejadorListarNotificaciones));
notificationsRouter.post("/read-all", requireAuth, asyncHandler(manejadorMarcarTodasLeidas));
notificationsRouter.post("/:id/read", requireAuth, asyncHandler(manejadorMarcarLeida));
notificationsRouter.delete("/", requireAuth, asyncHandler(manejadorEliminarTodas));
