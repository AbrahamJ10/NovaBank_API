import { Response, Request } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as billsService from "./bills.service";
import { affiliateSchema } from "./bills.validators";

export async function getCatalogHandler(_req: Request, res: Response) {
  const items = await billsService.getCatalog();
  res.json({ items });
}

export async function listBillsHandler(req: AuthenticatedRequest, res: Response) {
  const items = await billsService.listBills(req.user!.id);
  res.json({ items });
}

export async function affiliateHandler(req: AuthenticatedRequest, res: Response) {
  const input = affiliateSchema.parse(req.body);
  const bill = await billsService.affiliateBill(req.user!.id, input.billerKey, input.supplyNumber);
  res.status(201).json(bill);
}

const paramsSchema = z.object({ id: z.string().uuid() });

export async function payBillHandler(req: AuthenticatedRequest, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  await billsService.payBill(req.user!.id, id);
  res.status(204).send();
}

export async function suspendBillHandler(req: AuthenticatedRequest, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  const bill = await billsService.suspendBill(req.user!.id, id);
  res.json(bill);
}

export async function resumeBillHandler(req: AuthenticatedRequest, res: Response) {
  const { id } = paramsSchema.parse(req.params);
  const bill = await billsService.resumeBill(req.user!.id, id);
  res.json(bill);
}
