import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { getRequestMeta } from "../../lib/requestMeta";
import * as auditService from "./audit.service";
import { recordEventsSchema } from "./audit.validators";

export async function recordEventsHandler(req: AuthenticatedRequest, res: Response) {
  const { events } = recordEventsSchema.parse(req.body);
  await auditService.recordClientEvents(req.user!.id, events, getRequestMeta(req));
  res.status(204).send();
}
