import { Router } from "express";
import { requerirAutenticacion } from "../../intermediarios/requerirAutenticacion";
import { requerirAdmin } from "../../intermediarios/requerirAdmin";
import { adminLimiter } from "../../intermediarios/limiteTasa";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import * as c from "./administracion.controlador";

export const adminRouter = Router();

// Todo lo de este router es interno (rol ADMIN) — autenticación normal más
// la verificación de rol, sin excepciones.
adminRouter.use(requerirAutenticacion, requerirAdmin, adminLimiter);

adminRouter.get("/stats", asyncHandler(c.manejadorEstadisticas));

adminRouter.get("/users", asyncHandler(c.manejadorListarUsuarios));
adminRouter.get("/users/:id", asyncHandler(c.manejadorDetalleUsuario));
adminRouter.patch("/users/:id", asyncHandler(c.manejadorActualizarUsuario));
adminRouter.post("/users/:id/suspend", asyncHandler(c.manejadorSuspenderUsuario));
adminRouter.post("/users/:id/activate", asyncHandler(c.manejadorActivarUsuario));
adminRouter.post("/users/:id/unlock", asyncHandler(c.manejadorDesbloquearUsuario));
adminRouter.post("/users/:id/restore", asyncHandler(c.manejadorRestaurarUsuario));
adminRouter.post("/users/:id/reset-password", asyncHandler(c.manejadorRestablecerContrasena));
adminRouter.delete("/users/:id", asyncHandler(c.manejadorEliminarUsuario));

adminRouter.get("/login-events", asyncHandler(c.manejadorListarEventosLogin));
adminRouter.get("/audit-logs", asyncHandler(c.manejadorListarAuditoria));
adminRouter.get("/transactions", asyncHandler(c.manejadorListarTransaccionesGlobal));

adminRouter.post("/users/:id/notes", asyncHandler(c.manejadorCrearNota));
adminRouter.delete("/notes/:notaId", asyncHandler(c.manejadorEliminarNota));

adminRouter.get("/security-cases", asyncHandler(c.manejadorListarCasos));
adminRouter.post("/users/:id/security-cases", asyncHandler(c.manejadorCrearCaso));
adminRouter.patch("/security-cases/:casoId", asyncHandler(c.manejadorActualizarCaso));

adminRouter.get("/admin-actions", asyncHandler(c.manejadorListarAccionesAdmin));
