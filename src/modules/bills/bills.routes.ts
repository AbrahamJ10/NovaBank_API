import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { listBillsHandler, payBillHandler } from "./bills.controller";

export const billsRouter = Router();

billsRouter.get("/", requireAuth, asyncHandler(listBillsHandler));
billsRouter.post("/:id/pay", requireAuth, asyncHandler(payBillHandler));
