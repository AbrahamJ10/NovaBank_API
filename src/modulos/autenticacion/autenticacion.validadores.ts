import { z } from "zod";
import { esquemaContrasena } from "../../libreria/politicaContrasena";

export const esquemaRegistro = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: esquemaContrasena,
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

export const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const esquemaLoginFacial = z.object({
  email: z.string().trim().toLowerCase().email(),
  selfie: z.string().min(100),
});

export const esquemaRefrescar = z.object({
  refreshToken: z.string().min(20),
});

export const esquemaSolicitarRestablecerContrasena = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const esquemaConfirmarRestablecerContrasena = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
  newPassword: esquemaContrasena,
});

export type EntradaRegistro = z.infer<typeof esquemaRegistro>;
export type EntradaLogin = z.infer<typeof esquemaLogin>;
export type EntradaLoginFacial = z.infer<typeof esquemaLoginFacial>;
export type EntradaSolicitarRestablecerContrasena = z.infer<typeof esquemaSolicitarRestablecerContrasena>;
export type EntradaConfirmarRestablecerContrasena = z.infer<typeof esquemaConfirmarRestablecerContrasena>;
