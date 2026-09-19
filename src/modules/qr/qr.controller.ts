import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as qrService from "./qr.service";
import { payQrSchema } from "./qr.validators";

export async function payQrHandler(req: AuthenticatedRequest, res: Response) {
  const input = payQrSchema.parse(req.body);
  const receipt = await qrService.payQr(req.user!.id, input);
  res.status(201).json(receipt);
}
