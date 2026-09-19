import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { asyncHandler } from "../../lib/asyncHandler";
import { passwordResetLimiter, profileLimiter } from "../../middleware/rateLimit";
import { requestProfileOtpHandler, updateEmailHandler, updatePasswordHandler, updatePhoneHandler } from "./profile.controller";

export const profileRouter = Router();

// Reuses the same tight, email-sending ceiling as password-reset requests.
profileRouter.post("/otp/request", requireAuth, passwordResetLimiter, asyncHandler(requestProfileOtpHandler));
profileRouter.post("/email", requireAuth, profileLimiter, asyncHandler(updateEmailHandler));
profileRouter.post("/phone", requireAuth, profileLimiter, asyncHandler(updatePhoneHandler));
profileRouter.post("/password", requireAuth, profileLimiter, asyncHandler(updatePasswordHandler));
