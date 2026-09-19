import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as accountService from "./account.service";

export async function getAccountHandler(req: AuthenticatedRequest, res: Response) {
  const summary = await accountService.getAccountSummary(req.user!.id);
  res.json(summary);
}

const cardBlockSchema = z.object({ blocked: z.boolean() });

export async function setCardBlockedHandler(req: AuthenticatedRequest, res: Response) {
  const { blocked } = cardBlockSchema.parse(req.body);
  const cardBlocked = await accountService.setCardBlocked(req.user!.id, blocked);
  res.json({ cardBlocked });
}
