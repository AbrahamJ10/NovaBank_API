import express from "express";
import { applySecurityMiddleware } from "./middleware/security";
import { generalLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { healthRouter } from "./modules/health/health.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { dniRouter } from "./modules/dni/dni.routes";
import { verificationRouter } from "./modules/verification/verification.routes";
import { accountRouter } from "./modules/account/account.routes";
import { transactionsRouter } from "./modules/transactions/transactions.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { payeesRouter } from "./modules/payees/payees.routes";
import { transfersRouter } from "./modules/transfers/transfers.routes";
import { profileRouter } from "./modules/profile/profile.routes";
import { securityRouter } from "./modules/security/security.routes";
import { statementsRouter } from "./modules/statements/statements.routes";

export function createApp() {
  const app = express();

  applySecurityMiddleware(app);
  // 8mb covers a selfie + DNI photo pair as base64 for face verification;
  // every route that accepts a body this large is separately rate-limited.
  app.use(express.json({ limit: "8mb" }));
  app.use(generalLimiter);

  app.use(healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/dni", dniRouter);
  app.use("/api/verification", verificationRouter);
  app.use("/api/account", accountRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/payees", payeesRouter);
  app.use("/api/transfers", transfersRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/security", securityRouter);
  app.use("/api/statements", statementsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
