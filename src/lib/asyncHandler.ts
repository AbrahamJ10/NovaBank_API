import { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 doesn't forward rejected promises to the error handler on its
// own; wrap async route handlers so a thrown/rejected error still reaches it.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
