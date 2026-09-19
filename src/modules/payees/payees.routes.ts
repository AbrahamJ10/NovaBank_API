import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { createPayeeHandler, listPayeesHandler } from "./payees.controller";

export const payeesRouter = Router();

payeesRouter.get("/", requireAuth, asyncHandler(listPayeesHandler));
payeesRouter.post("/", requireAuth, asyncHandler(createPayeeHandler));
