import rateLimit from "express-rate-limit";

// Techo general para todo el tráfico de la API — amortigua abuso/DoS por
// script en la capa de aplicación (un DDoS volumétrico igual necesita
// detenerse más arriba, ej. Render/Cloudflare, esto no puede hacerlo solo).
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite más estricto específicamente para los endpoints de auth, para
// frenar el relleno de credenciales / fuerza bruta incluso antes de que
// entre en acción el bloqueo por cuenta.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta de nuevo en unos minutos." },
});

// Envía un correo real, así que este se mantiene estricto sin importar lo
// que permita authLimiter — refleja el límite de solicitudes de OTP del
// registro.
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intenta de nuevo más tarde." },
});

// Misma forma que passwordResetLimiter — un export aparte solo para que una
// ráfaga de intentos de restablecer contraseña no consuma también los
// intentos de transferencia de alguien durante la hora (y viceversa).
export const transferLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de transferencia, intenta de nuevo más tarde." },
});

// Protege los endpoints de cambio de correo/teléfono/contraseña del perfil
// — más estricto que transferLimiter ya que son operaciones sensibles,
// cercanas a un robo de cuenta, no tráfico rutinario del día a día.
export const profileLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intenta de nuevo más tarde." },
});

// La telemetría de navegación/toques de botón que reporta el cliente es
// frecuente por naturaleza (se envía en lotes cada pocos segundos mientras
// la app está abierta) — un techo generoso que solo existe para detener a
// un cliente descontrolado que inunde la tabla de auditoría.
export const auditLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados eventos, intenta de nuevo más tarde." },
});

// Generar un PDF de estado de cuenta es más pesado que una solicitud
// típica — se mantiene aparte para que una ráfaga de solicitudes de estado
// de cuenta no consuma también los intentos de restablecer contraseña de
// alguien durante la hora.
export const statementLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intenta de nuevo más tarde." },
});
