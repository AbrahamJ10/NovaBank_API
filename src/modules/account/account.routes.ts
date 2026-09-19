import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { getAccountHandler, setCardBlockedHandler } from "./account.controller";

export const accountRouter = Router();

accountRouter.get("/", requireAuth, asyncHandler(getAccountHandler));
accountRouter.post("/card-block", requireAuth, asyncHandler(setCardBlockedHandler));
