import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { manejadorCrearBeneficiario, manejadorListarBeneficiarios } from "./payees.controller";

export const payeesRouter = Router();

payeesRouter.get("/", requireAuth, asyncHandler(manejadorListarBeneficiarios));
payeesRouter.post("/", requireAuth, asyncHandler(manejadorCrearBeneficiario));
