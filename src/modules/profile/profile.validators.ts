import { z } from "zod";
import { passwordSchema } from "../../lib/passwordPolicy";

const otpCode = z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos");

export const updateEmailSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email("Correo inválido"),
  otpCode,
});

export const updatePhoneSchema = z.object({
  newPhone: z.string().trim().regex(/^9\d{8}$/, "Ingresa un celular peruano válido (9 dígitos)"),
  otpCode,
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: passwordSchema,
  otpCode,
});

export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
