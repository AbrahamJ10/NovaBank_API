import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { getCatalogHandler, listBillsHandler, affiliateHandler, payBillHandler, suspendBillHandler, resumeBillHandler } from "./bills.controller";

export const billsRouter = Router();

billsRouter.get("/catalog", requireAuth, asyncHandler(getCatalogHandler));
billsRouter.get("/", requireAuth, asyncHandler(listBillsHandler));
billsRouter.post("/affiliate", requireAuth, asyncHandler(affiliateHandler));
billsRouter.post("/:id/pay", requireAuth, asyncHandler(payBillHandler));
billsRouter.post("/:id/suspend", requireAuth, asyncHandler(suspendBillHandler));
billsRouter.post("/:id/resume", requireAuth, asyncHandler(resumeBillHandler));
