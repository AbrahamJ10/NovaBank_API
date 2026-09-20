import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as qrService from "./qr.service";
import { payQrSchema } from "./qr.validators";
import { getRequestMeta } from "../../lib/requestMeta";

export async function payQrHandler(req: AuthenticatedRequest, res: Response) {
  const input = payQrSchema.parse(req.body);
  const receipt = await qrService.payQr(req.user!.id, input, getRequestMeta(req));
  res.status(201).json(receipt);
}
