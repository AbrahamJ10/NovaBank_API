import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { lookupDni } from "./dni.service";

// Esto se llama desde la pantalla de registro antes de que exista una
// cuenta (y por lo tanto un Bearer token), así que no puede exigir auth —
// pero es un proxy hacia un tercero pagado y con límite de solicitudes,
// así que este techo se mantiene estricto sin importar lo que permita el
// límite general de la API.
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
