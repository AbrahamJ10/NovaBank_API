import { z } from "zod";
import { passwordSchema } from "../../lib/passwordPolicy";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(20).optional(),
  dni: z.string().trim().min(6).max(15).optional(),
  otpCode: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
  // Fotos de referencia facial del paso de verificación del registro,
  // guardadas para que un login con Face ID posterior tenga algo real
  // contra qué comparar. Opcional — el registro igual funciona sin ellas,
  // solo que sin login con Face ID después.
  dniPhoto: z.string().min(100).optional(),
  selfie: z.string().min(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const faceLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  selfie: z.string().min(100),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const passwordResetConfirmSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type FaceLoginInput = z.infer<typeof faceLoginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
