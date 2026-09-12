import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { lookupDni } from "./dni.service";

// This is called from the registration screen before an account (and thus a
// Bearer token) exists, so it can't require auth — but it proxies a paid,
// rate-limited third party, so keep this ceiling tight regardless of what
// the general API limiter allows.
const dniLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas consultas de DNI. Intenta de nuevo en unos minutos." },
});

const dniParamSchema = z.object({ dni: z.string().regex(/^\d{8}$/, "El DNI debe tener 8 dígitos") });

export const dniRouter = Router();

dniRouter.get(
  "/:dni",
  dniLimiter,
  asyncHandler(async (req, res) => {
    const { dni } = dniParamSchema.parse(req.params);
    const result = await lookupDni(dni);
    res.json(result);
  })
);
