import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as transactionsService from "./transactions.service";

export async function listTransactionsHandler(req: AuthenticatedRequest, res: Response) {
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 50;
  const items = await transactionsService.listTransactions(req.user!.id, limit);
  res.json({ items });
}
