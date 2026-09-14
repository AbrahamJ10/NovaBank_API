import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

export type FaceCompareResult = { matched: boolean; confidence: number; threshold: number };

function stripDataUriPrefix(base64: string) {
  const commaIndex = base64.indexOf(",");
  return base64.startsWith("data:") && commaIndex !== -1 ? base64.slice(commaIndex + 1) : base64;
}

// Compares a live selfie against the photo printed on the front of the DNI
// using Face++ (facepp.com) — a generic face-comparison model, not an
// official RENIEC biometric match (that access tier isn't sold to
// individual developers). Confidence is checked against Face++'s own
// "1e-4" false-accept-rate threshold, their recommended bar for
// security-sensitive use cases.
export async function compareFaces(selfieBase64: string, dniPhotoBase64: string): Promise<FaceCompareResult> {
  if (!env.FACEPP_API_KEY || !env.FACEPP_API_SECRET) {
    throw new HttpError(503, "El servicio de verificación facial no está configurado");
  }

  const form = new URLSearchParams();
  form.set("api_key", env.FACEPP_API_KEY);
  form.set("api_secret", env.FACEPP_API_SECRET);
  form.set("image_base64_1", stripDataUriPrefix(selfieBase64));
  form.set("image_base64_2", stripDataUriPrefix(dniPhotoBase64));

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

  console.log("[faceMatch] confidence:", data.confidence, "thresholds:", thresholds);

  return { matched: data.confidence >= threshold, confidence: data.confidence, threshold };
}
