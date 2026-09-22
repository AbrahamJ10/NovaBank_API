import { Router } from "express";
import { authLimiter, passwordResetLimiter } from "../../intermediarios/limiteTasa";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { requireAuth } from "../../intermediarios/requerirAutenticacion";
import {
  manejadorLoginFacial,
  manejadorLogin,
  manejadorCerrarSesion,
  manejadorPerfilPropio,
  manejadorConfirmarRestablecerContrasena,
  manejadorSolicitarRestablecerContrasena,
  manejadorRefrescar,
  manejadorRegistro,
} from "./autenticacion.controlador";

export const authRouter = Router();

authRouter.post("/register", authLimiter, asyncHandler(manejadorRegistro));
authRouter.post("/login", authLimiter, asyncHandler(manejadorLogin));
authRouter.post("/face-login", authLimiter, asyncHandler(manejadorLoginFacial));
authRouter.post("/password-reset/request", passwordResetLimiter, asyncHandler(manejadorSolicitarRestablecerContrasena));
authRouter.post("/password-reset/confirm", authLimiter, asyncHandler(manejadorConfirmarRestablecerContrasena));
authRouter.post("/refresh", authLimiter, asyncHandler(manejadorRefrescar));
authRouter.post("/logout", asyncHandler(manejadorCerrarSesion));
authRouter.get("/me", requireAuth, asyncHandler(manejadorPerfilPropio));
