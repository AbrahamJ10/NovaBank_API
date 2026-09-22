import { env } from "../../configuracion/entorno";
import { HttpError } from "../../intermediarios/manejadorErrores";

export type DniLookupResult = {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fullName: string;
};

// Consulta respaldada por RENIEC a través de Decolecta (https://decolecta.com).
// Los nombres de los campos están fijados a lo que su API realmente
// devuelve — verificado a mano contra una respuesta real, no adivinado de
// la documentación, ya que la forma de las APIs de terceros cambia.
export async function consultarDni(dni: string): Promise<DniLookupResult> {
  if (!env.DNI_PROVIDER_TOKEN) {
    throw new HttpError(503, "El servicio de verificación de identidad no está configurado");
  }

  const respuesta = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
    headers: { Authorization: `Bearer ${env.DNI_PROVIDER_TOKEN}` },
  });

  if (respuesta.status === 404) {
    throw new HttpError(404, "No se encontró información para ese DNI");
  }
  if (respuesta.status === 429) {
    throw new HttpError(429, "Se alcanzó el límite de consultas del proveedor, intenta más tarde");
  }
  if (!respuesta.ok) {
    throw new HttpError(502, "El servicio de verificación de identidad no está disponible");
  }

  const datos = (await respuesta.json()) as Record<string, unknown>;

  const nombres = String(datos.first_name ?? "");
  const apellidoPaterno = String(datos.first_last_name ?? "");
  const apellidoMaterno = String(datos.second_last_name ?? "");
  const nombreCompleto = String(datos.full_name ?? [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" "));

  if (!nombres && !nombreCompleto) {
    throw new HttpError(502, "Respuesta inesperada del servicio de verificación de identidad");
  }

  return { dni, nombres, apellidoPaterno, apellidoMaterno, fullName: nombreCompleto };
}
