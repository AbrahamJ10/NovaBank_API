import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { statementLimiter } from "../../middleware/rateLimit";
import { sendStatementHandler } from "./statements.controller";

export const statementsRouter = Router();

statementsRouter.post("/send", requireAuth, statementLimiter, asyncHandler(sendStatementHandler));
