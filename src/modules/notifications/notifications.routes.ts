import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { deleteAllHandler, listNotificationsHandler, markAllReadHandler, markReadHandler } from "./notifications.controller";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, asyncHandler(listNotificationsHandler));
notificationsRouter.post("/read-all", requireAuth, asyncHandler(markAllReadHandler));
notificationsRouter.post("/:id/read", requireAuth, asyncHandler(markReadHandler));
notificationsRouter.delete("/", requireAuth, asyncHandler(deleteAllHandler));
