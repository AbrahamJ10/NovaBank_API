import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../libreria/jwt";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

export function requireAuth(peticion: AuthenticatedRequest, respuesta: Response, siguiente: NextFunction): void {
  const encabezado = peticion.headers.authorization;
  if (!encabezado?.startsWith("Bearer ")) {
    respuesta.status(401).json({ error: "No autenticado" });
    return;
  }

  try {
    const contenido = verifyAccessToken(encabezado.slice("Bearer ".length));
    peticion.user = { id: contenido.sub, email: contenido.email };
    siguiente();
  } catch {
    respuesta.status(401).json({ error: "Token inválido o expirado" });
  }
}
