import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../configuracion/entorno";

export class ErrorHttp extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export function notFoundHandler(_peticion: Request, respuesta: Response): void {
  respuesta.status(404).json({ error: "Recurso no encontrado" });
}

// Manejador de errores centralizado — mantiene los stack traces y detalles
// internos fuera de las respuestas en producción para no filtrar detalles
// de implementación a quien llame.
export function errorHandler(error: unknown, _peticion: Request, respuesta: Response, _siguiente: NextFunction): void {
  if (error instanceof ZodError) {
    respuesta.status(400).json({ error: "Datos inválidos", details: error.flatten() });
    return;
  }

  if (error instanceof ErrorHttp) {
    respuesta.status(error.status).json({ error: error.message, ...(error.details ?? {}) });
    return;
  }

  // express.json() lanza un SyntaxError (body-parser le pone status 400)
  // cuando el cuerpo de la solicitud no es JSON válido — es una solicitud
  // del cliente mal formada, no una falla del servidor, así que esto no
  // debe caer en el 500 genérico de abajo.
  if (error instanceof SyntaxError && (error as SyntaxError & { status?: number }).status === 400) {
    respuesta.status(400).json({ error: "El cuerpo de la solicitud no es JSON válido" });
    return;
  }

  console.error(error);
  respuesta.status(500).json({ error: env.isProduction ? "Error interno del servidor" : String(error) });
}
