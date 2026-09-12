import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Recurso no encontrado" });
}

// Centralized error handler — keeps stack traces and internal details out of
// responses in production so we don't leak implementation details to callers.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos inválidos", details: err.flatten() });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ?? {}) });
    return;
  }

  console.error(err);
  res.status(500).json({ error: env.isProduction ? "Error interno del servidor" : String(err) });
}
