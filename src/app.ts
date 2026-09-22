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
import { billsRouter } from "./modules/bills/bills.routes";
import { withdrawalsRouter } from "./modules/withdrawals/withdrawals.routes";
import { qrRouter } from "./modules/qr/qr.routes";
import { auditRouter } from "./modules/audit/audit.routes";

export function crearApp() {
  const app = express();

  applySecurityMiddleware(app);
  // 8mb cubre un par selfie + foto de DNI en base64 para la verificación
  // facial; toda ruta que acepta un cuerpo así de grande tiene su propio
  // límite de solicitudes aparte.
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
  app.use("/api/bills", billsRouter);
  app.use("/api/withdrawals", withdrawalsRouter);
  app.use("/api/qr", qrRouter);
  app.use("/api/audit", auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
