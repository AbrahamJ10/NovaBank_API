import { z } from "zod";

// Single source of truth for password strength — every place a user sets a
// password (register, password-reset, change-password from Profile) must
// enforce the exact same rule, or one path ends up weaker than the others.
export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .regex(/[a-z]/, "Debe incluir una minúscula")
  .regex(/[A-Z]/, "Debe incluir una mayúscula")
  .regex(/[0-9]/, "Debe incluir un número");
