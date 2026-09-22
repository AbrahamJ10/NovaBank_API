import { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 no reenvía promesas rechazadas al manejador de errores por su
// cuenta; envuelve los manejadores de ruta async para que un error
// lanzado/rechazado igual llegue ahí.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
