import express from "express";
import { applySecurityMiddleware } from "./intermediarios/seguridad";
import { generalLimiter } from "./intermediarios/limiteTasa";
import { errorHandler, notFoundHandler } from "./intermediarios/manejadorErrores";
import { healthRouter } from "./modulos/salud/salud.rutas";
import { authRouter } from "./modulos/autenticacion/autenticacion.rutas";
import { dniRouter } from "./modulos/dni/dni.rutas";
import { verificationRouter } from "./modulos/verificacion/verificacion.rutas";
import { accountRouter } from "./modulos/cuenta/cuenta.rutas";
import { transactionsRouter } from "./modulos/transacciones/transacciones.rutas";
import { notificationsRouter } from "./modulos/notificaciones/notificaciones.rutas";
import { payeesRouter } from "./modulos/destinatarios/destinatarios.rutas";
import { transfersRouter } from "./modulos/transferencias/transferencias.rutas";
import { profileRouter } from "./modulos/perfil/perfil.rutas";
import { securityRouter } from "./modulos/seguridad/seguridad.rutas";
import { statementsRouter } from "./modulos/estadosCuenta/estadosCuenta.rutas";
import { billsRouter } from "./modulos/recibos/recibos.rutas";
import { withdrawalsRouter } from "./modulos/retiros/retiros.rutas";
import { qrRouter } from "./modulos/qr/qr.rutas";
import { auditRouter } from "./modulos/auditoria/auditoria.rutas";

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
