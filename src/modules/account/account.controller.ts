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

const payCardSchema = z.object({ amount: z.number().positive() });

export async function payCardHandler(req: AuthenticatedRequest, res: Response) {
  const { amount } = payCardSchema.parse(req.body);
  const summary = await accountService.payCard(req.user!.id, amount);
  res.json(summary);
}

const revealCvvSchema = z.object({ otpCode: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos") });

export async function revealCvvHandler(req: AuthenticatedRequest, res: Response) {
  const { otpCode } = revealCvvSchema.parse(req.body);
  const result = await accountService.revealCvv(req.user!.id, otpCode);
  res.json(result);
}
