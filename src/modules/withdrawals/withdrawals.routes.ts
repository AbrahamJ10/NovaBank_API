import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { createWithdrawalHandler, cancelWithdrawalHandler, renewWithdrawalHandler } from "./withdrawals.controller";

export const withdrawalsRouter = Router();

withdrawalsRouter.post("/", requireAuth, asyncHandler(createWithdrawalHandler));
withdrawalsRouter.post("/:id/cancel", requireAuth, asyncHandler(cancelWithdrawalHandler));
withdrawalsRouter.post("/:id/renew", requireAuth, asyncHandler(renewWithdrawalHandler));
