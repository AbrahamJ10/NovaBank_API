import { z } from "zod";
import { esquemaContrasena } from "../../libreria/politicaContrasena";

const codigoOtp = z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos");

export const esquemaActualizarCorreo = z.object({
  newEmail: z.string().trim().toLowerCase().email("Correo inválido"),
  otpCode: codigoOtp,
});

export const esquemaActualizarTelefono = z.object({
  newPhone: z.string().trim().regex(/^9\d{8}$/, "Ingresa un celular peruano válido (9 dígitos)"),
  otpCode: codigoOtp,
});

export const esquemaActualizarContrasena = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: esquemaContrasena,
  otpCode: codigoOtp,
});

export type EntradaActualizarCorreo = z.infer<typeof esquemaActualizarCorreo>;
export type EntradaActualizarTelefono = z.infer<typeof esquemaActualizarTelefono>;
export type EntradaActualizarContrasena = z.infer<typeof esquemaActualizarContrasena>;
