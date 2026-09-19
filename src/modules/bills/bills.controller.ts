import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as billsService from "./bills.service";

export async function listBillsHandler(req: AuthenticatedRequest, res: Response) {
  const items = await billsService.listBills(req.user!.id);
  res.json({ items });
}

const paramsSchema = z.object({ id: z.string().uuid() });

export async function payBillHandler(req: AuthenticatedRequest, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  await billsService.payBill(req.user!.id, id);
  res.status(204).send();
}
