import { z } from "zod";

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
  newPassword: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres")
    .regex(/\d/, "La nueva contraseña debe incluir un número")
    .regex(/[A-Z]/, "La nueva contraseña debe incluir una mayúscula"),
  otpCode,
});

export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
