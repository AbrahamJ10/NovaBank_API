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
const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de código, intenta de nuevo más tarde." },
});

const faceMatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de verificación facial, intenta de nuevo más tarde." },
});

const otpRequestSchema = z.object({ email: z.string().trim().toLowerCase().email() });

const faceMatchSchema = z.object({
  dni: z.string().regex(/^\d{8}$/),
  selfie: z.string().min(100),
  dniPhoto: z.string().min(100),
});

export const verificationRouter = Router();

verificationRouter.post(
  "/otp/request",
  otpRequestLimiter,
  asyncHandler(async (req, res) => {
    const { email } = otpRequestSchema.parse(req.body);
    await requestRegisterOtp(email);
    res.status(204).send();
  })
);

verificationRouter.post(
  "/face-match",
  faceMatchLimiter,
  asyncHandler(async (req, res) => {
    const { dni, selfie, dniPhoto } = faceMatchSchema.parse(req.body);
    const result = await compareFaces({ base64: selfie }, { base64: dniPhoto });

    await prisma.faceVerificationEvent.create({
      data: { dni, matched: result.matched, confidence: result.confidence, ip: req.ip, userAgent: req.headers["user-agent"] },
    });

    res.json(result);
  })
);
