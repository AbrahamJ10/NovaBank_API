import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}
