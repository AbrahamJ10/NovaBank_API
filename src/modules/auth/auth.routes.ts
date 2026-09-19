import { Router } from "express";
import { authLimiter, passwordResetLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import {
  faceLoginHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  passwordResetConfirmHandler,
  passwordResetRequestHandler,
  refreshHandler,
  registerHandler,
} from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", authLimiter, asyncHandler(registerHandler));
authRouter.post("/login", authLimiter, asyncHandler(loginHandler));
authRouter.post("/face-login", authLimiter, asyncHandler(faceLoginHandler));
authRouter.post("/password-reset/request", passwordResetLimiter, asyncHandler(passwordResetRequestHandler));
authRouter.post("/password-reset/confirm", authLimiter, asyncHandler(passwordResetConfirmHandler));
authRouter.post("/refresh", authLimiter, asyncHandler(refreshHandler));
authRouter.post("/logout", asyncHandler(logoutHandler));
authRouter.get("/me", requireAuth, asyncHandler(meHandler));
