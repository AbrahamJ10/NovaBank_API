import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as payeesService from "./payees.service";

export async function listPayeesHandler(req: AuthenticatedRequest, res: Response) {
  const items = await payeesService.listPayees(req.user!.id);
  res.json({ items });
}

const createPayeeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  bank: z.string().trim().min(2).max(60),
  accountNumber: z.string().trim().min(4).max(30),
});

export async function createPayeeHandler(req: AuthenticatedRequest, res: Response) {
  const input = createPayeeSchema.parse(req.body);
  const payee = await payeesService.createPayee(req.user!.id, input);
  res.status(201).json(payee);
}
