import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as withdrawalsService from "./withdrawals.service";
import { getRequestMeta } from "../../lib/requestMeta";

const createSchema = z.object({ amount: z.number().positive() });

export async function createWithdrawalHandler(req: AuthenticatedRequest, res: Response) {
  const { amount } = createSchema.parse(req.body);
  const withdrawal = await withdrawalsService.createWithdrawal(req.user!.id, amount, getRequestMeta(req));
  res.status(201).json(withdrawal);
}

const paramsSchema = z.object({ id: z.string().uuid() });

export async function cancelWithdrawalHandler(req: AuthenticatedRequest, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  await withdrawalsService.cancelWithdrawal(req.user!.id, id, getRequestMeta(req));
  res.status(204).send();
}

export async function renewWithdrawalHandler(req: AuthenticatedRequest, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  const withdrawal = await withdrawalsService.renewWithdrawal(req.user!.id, id, getRequestMeta(req));
  res.json(withdrawal);
}
