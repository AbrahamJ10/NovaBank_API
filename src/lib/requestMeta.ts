import { Request } from "express";
import geoip from "geoip-lite";

// Compartido por todo controlador que necesite describir "quién/dónde/con
// qué dispositivo" hizo una solicitud — se usa tanto para el meta existente
// de LoginEvent/RefreshToken como para el rastro de auditoría (ver
// modules/audit). country/city son un cálculo aproximado a partir de la IP
// de la solicitud (base de datos offline tipo MaxMind-lite, sin llamada
// externa); esto NO es un ubigeo peruano preciso (departamento/provincia/
// distrito), que requeriría que la app pida la ubicación por GPS — no está
// implementado.
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  device?: string;
  platform?: string;
  appVersion?: string;
  country?: string;
  city?: string;
}

function normalizeIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  // IPv6 con IPv4 embebida (::ffff:1.2.3.4), común en tráfico local/proxeado
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export function getRequestMeta(req: Request): RequestMeta {
  const ip = normalizeIp(req.ip);
  const lookup = ip ? geoip.lookup(ip) : null;

  return {
    ip,
    userAgent: req.headers["user-agent"] as string | undefined,
    device: (req.headers["x-device-model"] as string | undefined) || undefined,
    platform: (req.headers["x-platform"] as string | undefined) || undefined,
    appVersion: (req.headers["x-app-version"] as string | undefined) || undefined,
    country: lookup?.country || undefined,
    city: lookup?.city || undefined,
  };
}
