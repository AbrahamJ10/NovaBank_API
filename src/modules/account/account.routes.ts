import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { profileLimiter } from "../../middleware/rateLimit";
import { getAccountHandler, setCardBlockedHandler, payCardHandler, revealCvvHandler } from "./account.controller";

export const accountRouter = Router();

accountRouter.get("/", requireAuth, asyncHandler(getAccountHandler));
accountRouter.post("/card-block", requireAuth, asyncHandler(setCardBlockedHandler));
accountRouter.post("/pay-card", requireAuth, asyncHandler(payCardHandler));
accountRouter.post("/reveal-cvv", requireAuth, profileLimiter, asyncHandler(revealCvvHandler));
