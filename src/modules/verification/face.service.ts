import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

export type FaceCompareResult = { matched: boolean; confidence: number; threshold: number };

type ImageInput = { base64: string } | { url: string };

function stripDataUriPrefix(base64: string) {
  const commaIndex = base64.indexOf(",");
  return base64.startsWith("data:") && commaIndex !== -1 ? base64.slice(commaIndex + 1) : base64;
}

function setImageField(form: URLSearchParams, index: 1 | 2, image: ImageInput) {
  if ("url" in image) {
    form.set(`image_url${index}`, image.url);
  } else {
    form.set(`image_base64_${index}`, stripDataUriPrefix(image.base64));
  }
}

// Compara dos rostros (cada uno dado como base64 o una URL alojada) usando
// Face++ (facepp.com) — un modelo genérico de comparación facial, no una
// coincidencia biométrica oficial de RENIEC (ese nivel de acceso no se
// vende a desarrolladores individuales). La confianza se compara contra el
// umbral propio de Face++ de tasa de falsos positivos "1e-4", su barra
// recomendada para casos de uso sensibles a la seguridad.
export async function compareFaces(image1: ImageInput, image2: ImageInput): Promise<FaceCompareResult> {
  if (!env.FACEPP_API_KEY || !env.FACEPP_API_SECRET) {
    throw new HttpError(503, "El servicio de verificación facial no está configurado");
  }

  const form = new URLSearchParams();
  form.set("api_key", env.FACEPP_API_KEY);
  form.set("api_secret", env.FACEPP_API_SECRET);
  setImageField(form, 1, image1);
  setImageField(form, 2, image2);

  const res = await fetch(`${env.FACEPP_API_BASE}/facepp/v3/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || typeof data.error_message === "string") {
    console.error("Face++ error:", res.status, data.error_message);
    throw new HttpError(502, "El servicio de verificación facial no está disponible");
  }

  if (typeof data.confidence !== "number") {
    throw new HttpError(422, "No se detectó un rostro claro en una de las fotos, intenta de nuevo con mejor iluminación");
  }

  const thresholds = data.thresholds as Record<string, number> | undefined;
  const threshold = thresholds?.["1e-4"] ?? 75;

  return { matched: data.confidence >= threshold, confidence: data.confidence, threshold };
}
