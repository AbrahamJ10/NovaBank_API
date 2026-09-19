import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { listTransactionsHandler } from "./transactions.controller";

export const transactionsRouter = Router();

transactionsRouter.get("/", requireAuth, asyncHandler(listTransactionsHandler));
