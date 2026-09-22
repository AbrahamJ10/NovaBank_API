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
export interface MetaSolicitud {
  ip?: string;
  userAgent?: string;
  device?: string;
  platform?: string;
  appVersion?: string;
  country?: string;
  city?: string;
}

function normalizarIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  // IPv6 con IPv4 embebida (::ffff:1.2.3.4), común en tráfico local/proxeado
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export function obtenerMetaSolicitud(peticion: Request): MetaSolicitud {
  const ip = normalizarIp(peticion.ip);
  const consulta = ip ? geoip.lookup(ip) : null;

  return {
    ip,
    userAgent: peticion.headers["user-agent"] as string | undefined,
    device: (peticion.headers["x-device-model"] as string | undefined) || undefined,
    platform: (peticion.headers["x-platform"] as string | undefined) || undefined,
    appVersion: (peticion.headers["x-app-version"] as string | undefined) || undefined,
    country: consulta?.country || undefined,
    city: consulta?.city || undefined,
  };
}
