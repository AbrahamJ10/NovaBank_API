import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { prisma } from "../../lib/prisma";
import { requestRegisterOtp } from "./otp.service";
import { compareFaces } from "./face.service";

// Los dos endpoints se ejecutan antes de que exista una cuenta, así que
// ninguno puede exigir auth — pero uno envía un correo real y el otro
// llama a una API de terceros con medición, así que ambos tienen su propio
// techo estricto sin importar el límite general.
const limitadorSolicitudOtp = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de código, intenta de nuevo más tarde." },
});

const limitadorCoincidenciaFacial = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de verificación facial, intenta de nuevo más tarde." },
});

const esquemaSolicitudOtp = z.object({ email: z.string().trim().toLowerCase().email() });

const esquemaCoincidenciaFacial = z.object({
  dni: z.string().regex(/^\d{8}$/),
  selfie: z.string().min(100),
  dniPhoto: z.string().min(100),
});

export const verificationRouter = Router();

verificationRouter.post(
  "/otp/request",
  limitadorSolicitudOtp,
  asyncHandler(async (peticion, respuesta) => {
    const { email } = esquemaSolicitudOtp.parse(peticion.body);
    await requestRegisterOtp(email);
    respuesta.status(204).send();
  })
);

verificationRouter.post(
  "/face-match",
  limitadorCoincidenciaFacial,
  asyncHandler(async (peticion, respuesta) => {
    const { dni, selfie, dniPhoto } = esquemaCoincidenciaFacial.parse(peticion.body);
    const resultado = await compareFaces({ base64: selfie }, { base64: dniPhoto });

    await prisma.faceVerificationEvent.create({
      data: { dni, matched: resultado.matched, confidence: resultado.confidence, ip: peticion.ip, userAgent: peticion.headers["user-agent"] },
    });

    respuesta.json(resultado);
  })
);
