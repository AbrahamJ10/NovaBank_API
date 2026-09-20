import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as securityService from "./security.service";
import { revokeSessionParamsSchema, sessionTokenSchema, updateAlertsSchema, updateLimitsSchema } from "./security.validators";
import { getRequestMeta } from "../../lib/requestMeta";

export async function getAlertsHandler(req: AuthenticatedRequest, res: Response) {
  res.json(await securityService.getAlerts(req.user!.id));
}

export async function updateAlertsHandler(req: AuthenticatedRequest, res: Response) {
  const input = updateAlertsSchema.parse(req.body);
  res.json(await securityService.updateAlerts(req.user!.id, input, getRequestMeta(req)));
}

export async function getLimitsHandler(req: AuthenticatedRequest, res: Response) {
  res.json(await securityService.getLimits(req.user!.id));
}

export async function updateLimitsHandler(req: AuthenticatedRequest, res: Response) {
  const input = updateLimitsSchema.parse(req.body);
  res.json(await securityService.updateLimits(req.user!.id, input, getRequestMeta(req)));
}

export async function listSessionsHandler(req: AuthenticatedRequest, res: Response) {
  const { refreshToken } = sessionTokenSchema.parse(req.body);
  const items = await securityService.listSessions(req.user!.id, refreshToken);
  res.json({ items });
}

export async function revokeSessionHandler(req: AuthenticatedRequest, res: Response) {
  const { id } = revokeSessionParamsSchema.parse(req.params);
  await securityService.revokeSession(req.user!.id, id, getRequestMeta(req));
  res.status(204).send();
}

export async function revokeOtherSessionsHandler(req: AuthenticatedRequest, res: Response) {
  const { refreshToken } = sessionTokenSchema.parse(req.body);
  await securityService.revokeOtherSessions(req.user!.id, refreshToken, getRequestMeta(req));
  res.status(204).send();
}
