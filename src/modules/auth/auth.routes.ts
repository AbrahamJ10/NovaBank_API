import { Router } from "express";
import { authLimiter, passwordResetLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import {
  manejadorLoginFacial,
  manejadorLogin,
  manejadorCerrarSesion,
  manejadorPerfilPropio,
  manejadorConfirmarRestablecerContrasena,
  manejadorSolicitarRestablecerContrasena,
  manejadorRefrescar,
  manejadorRegistro,
} from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", authLimiter, asyncHandler(manejadorRegistro));
authRouter.post("/login", authLimiter, asyncHandler(manejadorLogin));
authRouter.post("/face-login", authLimiter, asyncHandler(manejadorLoginFacial));
authRouter.post("/password-reset/request", passwordResetLimiter, asyncHandler(manejadorSolicitarRestablecerContrasena));
authRouter.post("/password-reset/confirm", authLimiter, asyncHandler(manejadorConfirmarRestablecerContrasena));
authRouter.post("/refresh", authLimiter, asyncHandler(manejadorRefrescar));
authRouter.post("/logout", asyncHandler(manejadorCerrarSesion));
authRouter.get("/me", requireAuth, asyncHandler(manejadorPerfilPropio));
