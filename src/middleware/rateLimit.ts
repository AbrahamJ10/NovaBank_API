import rateLimit from "express-rate-limit";

// General ceiling for all API traffic — blunts scripted abuse/DoS at the
// application layer (volumetric DDoS still needs to be stopped upstream, e.g.
// Render/Cloudflare, this cannot do that on its own).
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit specifically for auth endpoints to slow down credential
// stuffing / brute force even before the per-account lockout kicks in.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta de nuevo en unos minutos." },
});

// Sends a real email, so this stays tight regardless of what authLimiter
// allows — mirrors the registration OTP request limiter.
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intenta de nuevo más tarde." },
});
