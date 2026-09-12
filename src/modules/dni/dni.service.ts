import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

export type DniLookupResult = {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fullName: string;
};

// Decolecta's RENIEC-backed lookup (https://decolecta.com). Field names are
// pinned to what their API actually returns — verified by hand against a
// live response, not guessed from docs, since third-party API shapes drift.
export async function lookupDni(dni: string): Promise<DniLookupResult> {
  if (!env.DNI_PROVIDER_TOKEN) {
    throw new HttpError(503, "El servicio de verificación de identidad no está configurado");
  }

  const res = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
    headers: { Authorization: `Bearer ${env.DNI_PROVIDER_TOKEN}` },
  });

  if (res.status === 404) {
    throw new HttpError(404, "No se encontró información para ese DNI");
  }
  if (res.status === 429) {
    throw new HttpError(429, "Se alcanzó el límite de consultas del proveedor, intenta más tarde");
  }
  if (!res.ok) {
    throw new HttpError(502, "El servicio de verificación de identidad no está disponible");
  }

  const data = (await res.json()) as Record<string, unknown>;

  const nombres = String(data.first_name ?? "");
  const apellidoPaterno = String(data.first_last_name ?? "");
  const apellidoMaterno = String(data.second_last_name ?? "");
  const fullName = String(data.full_name ?? [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" "));

  if (!nombres && !fullName) {
    throw new HttpError(502, "Respuesta inesperada del servicio de verificación de identidad");
  }

  return { dni, nombres, apellidoPaterno, apellidoMaterno, fullName };
}
