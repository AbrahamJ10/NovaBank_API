import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  getAlertsHandler,
  updateAlertsHandler,
  getLimitsHandler,
  updateLimitsHandler,
  listSessionsHandler,
  revokeSessionHandler,
  revokeOtherSessionsHandler,
} from "./security.controller";

export const securityRouter = Router();

securityRouter.get("/alerts", requireAuth, asyncHandler(getAlertsHandler));
securityRouter.put("/alerts", requireAuth, asyncHandler(updateAlertsHandler));
securityRouter.get("/limits", requireAuth, asyncHandler(getLimitsHandler));
securityRouter.put("/limits", requireAuth, asyncHandler(updateLimitsHandler));
securityRouter.post("/sessions", requireAuth, asyncHandler(listSessionsHandler));
securityRouter.delete("/sessions/:id", requireAuth, asyncHandler(revokeSessionHandler));
securityRouter.post("/sessions/revoke-others", requireAuth, asyncHandler(revokeOtherSessionsHandler));
