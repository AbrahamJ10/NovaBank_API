import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { payQrHandler } from "./qr.controller";

export const qrRouter = Router();

qrRouter.post("/pay", requireAuth, asyncHandler(payQrHandler));
