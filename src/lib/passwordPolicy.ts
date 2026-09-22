import { z } from "zod";

// Única fuente de verdad para la fortaleza de la contraseña — todo lugar
// donde un usuario establece una contraseña (registro, restablecer
// contraseña, cambiar contraseña desde Perfil) debe aplicar exactamente la
// misma regla, o un camino termina siendo más débil que los demás.
export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .regex(/[a-z]/, "Debe incluir una minúscula")
  .regex(/[A-Z]/, "Debe incluir una mayúscula")
  .regex(/[0-9]/, "Debe incluir un número");
