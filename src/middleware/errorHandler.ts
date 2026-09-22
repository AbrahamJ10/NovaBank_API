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

// Manejador de errores centralizado — mantiene los stack traces y detalles
// internos fuera de las respuestas en producción para no filtrar detalles
// de implementación a quien llame.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos inválidos", details: err.flatten() });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ?? {}) });
    return;
  }

  // express.json() lanza un SyntaxError (body-parser le pone status 400)
  // cuando el cuerpo de la solicitud no es JSON válido — es una solicitud
  // del cliente mal formada, no una falla del servidor, así que esto no
  // debe caer en el 500 genérico de abajo.
  if (err instanceof SyntaxError && (err as SyntaxError & { status?: number }).status === 400) {
    res.status(400).json({ error: "El cuerpo de la solicitud no es JSON válido" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: env.isProduction ? "Error interno del servidor" : String(err) });
}
