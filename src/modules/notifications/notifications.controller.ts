import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as notificationsService from "./notifications.service";

export async function listNotificationsHandler(req: AuthenticatedRequest, res: Response) {
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 50;
  const items = await notificationsService.listNotifications(req.user!.id, limit);
  res.json({ items });
}

export async function markAllReadHandler(req: AuthenticatedRequest, res: Response) {
  await notificationsService.markAllRead(req.user!.id);
  res.status(204).send();
}

const paramsSchema = z.object({ id: z.string().uuid() });

export async function markReadHandler(req: AuthenticatedRequest, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  await notificationsService.markRead(req.user!.id, id);
  res.status(204).send();
}
