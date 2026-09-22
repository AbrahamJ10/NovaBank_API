import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

export type FaceCompareResult = { matched: boolean; confidence: number; threshold: number };

type EntradaImagen = { base64: string } | { url: string };

function quitarPrefijoDataUri(base64: string) {
  const indiceComa = base64.indexOf(",");
  return base64.startsWith("data:") && indiceComa !== -1 ? base64.slice(indiceComa + 1) : base64;
}

function establecerCampoImagen(form: URLSearchParams, indice: 1 | 2, imagen: EntradaImagen) {
  if ("url" in imagen) {
    form.set(`image_url${indice}`, imagen.url);
  } else {
    form.set(`image_base64_${indice}`, quitarPrefijoDataUri(imagen.base64));
  }
}

// Compara dos rostros (cada uno dado como base64 o una URL alojada) usando
// Face++ (facepp.com) — un modelo genérico de comparación facial, no una
// coincidencia biométrica oficial de RENIEC (ese nivel de acceso no se
// vende a desarrolladores individuales). La confianza se compara contra el
// umbral propio de Face++ de tasa de falsos positivos "1e-4", su barra
// recomendada para casos de uso sensibles a la seguridad.
export async function compareFaces(imagen1: EntradaImagen, imagen2: EntradaImagen): Promise<FaceCompareResult> {
  if (!env.FACEPP_API_KEY || !env.FACEPP_API_SECRET) {
    throw new HttpError(503, "El servicio de verificación facial no está configurado");
  }

  const form = new URLSearchParams();
  form.set("api_key", env.FACEPP_API_KEY);
  form.set("api_secret", env.FACEPP_API_SECRET);
  establecerCampoImagen(form, 1, imagen1);
  establecerCampoImagen(form, 2, imagen2);

  const respuesta = await fetch(`${env.FACEPP_API_BASE}/facepp/v3/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;

  if (!respuesta.ok || typeof datos.error_message === "string") {
    console.error("Error de Face++:", respuesta.status, datos.error_message);
    throw new HttpError(502, "El servicio de verificación facial no está disponible");
  }

  if (typeof datos.confidence !== "number") {
    throw new HttpError(422, "No se detectó un rostro claro en una de las fotos, intenta de nuevo con mejor iluminación");
  }

  const umbrales = datos.thresholds as Record<string, number> | undefined;
  const umbral = umbrales?.["1e-4"] ?? 75;

  return { matched: datos.confidence >= umbral, confidence: datos.confidence, threshold: umbral };
}
