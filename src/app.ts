import express from "express";
import { applySecurityMiddleware } from "./middleware/security";
import { generalLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { healthRouter } from "./modules/health/health.routes";
import { authRouter } from "./modules/auth/auth.routes";

export function createApp() {
  const app = express();

  applySecurityMiddleware(app);
  app.use(express.json({ limit: "100kb" }));
  app.use(generalLimiter);

  app.use(healthRouter);
  app.use("/api/auth", authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
