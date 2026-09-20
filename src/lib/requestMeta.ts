import { Request } from "express";
import geoip from "geoip-lite";

// Shared by every controller that needs to describe "who/where/what device"
// made a request — used both for the existing LoginEvent/RefreshToken meta
// and for the audit trail (see modules/audit). Country/city are best-effort
// from the request IP (MaxMind-lite offline DB, no external call); this is
// NOT a precise Peruvian ubigeo (department/province/district), which would
// require the app to ask for GPS location — not implemented.
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
  // IPv4-mapped IPv6 (::ffff:1.2.3.4), common for local/proxied traffic
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
