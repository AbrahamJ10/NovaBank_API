import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../../libreria/manejadorAsincrono";
import { consultarDni } from "./dni.servicio";

// Esto se llama desde la pantalla de registro antes de que exista una
// cuenta (y por lo tanto un Bearer token), así que no puede exigir auth —
// pero es un proxy hacia un tercero pagado y con límite de solicitudes,
// así que este techo se mantiene estricto sin importar lo que permita el
// límite general de la API.
const limitadorDni = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas consultas de DNI. Intenta de nuevo en unos minutos." },
});

const esquemaParametroDni = z.object({ dni: z.string().regex(/^\d{8}$/, "El DNI debe tener 8 dígitos") });

export const dniRouter = Router();

dniRouter.get(
  "/:dni",
  limitadorDni,
  asyncHandler(async (peticion, respuesta) => {
    const { dni } = esquemaParametroDni.parse(peticion.params);
    const resultado = await consultarDni(dni);
    respuesta.json(resultado);
  })
);
