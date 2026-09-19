import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as transfersService from "./transfers.service";

export async function requestTransferOtpHandler(req: AuthenticatedRequest, res: Response) {
  await transfersService.requestTransfer(req.user!.email);
  res.status(204).send();
}

const executeSchema = z.object({
  payeeId: z.string().uuid(),
  amount: z.number().positive(),
  concept: z.string().trim().min(1).max(140),
  otpCode: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});

export async function executeTransferHandler(req: AuthenticatedRequest, res: Response) {
  const input = executeSchema.parse(req.body);
  const receipt = await transfersService.executeTransfer(req.user!.id, req.user!.email, input);
  res.status(201).json(receipt);
}
