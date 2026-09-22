import sharp from "sharp";
import { env } from "../../configuracion/entorno";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";

export type FaceCompareResult = { matched: boolean; confidence: number; threshold: number };

type EntradaImagen = { base64: string } | { url: string };

function quitarPrefijoDataUri(base64: string) {
  const indiceComa = base64.indexOf(",");
  return base64.startsWith("data:") && indiceComa !== -1 ? base64.slice(indiceComa + 1) : base64;
}

// La foto del DNI se captura en alta resolución para que el OCR lea bien el
// texto, así que su base64 puede superar el límite de tamaño de Face++
// (2 MB). Aquí se reduce solo la copia que se envía a comparar, sin tocar
// la foto original que ya se usó para leer los datos del documento.
async function comprimirParaFacepp(base64: string): Promise<string> {
  const buffer = Buffer.from(quitarPrefijoDataUri(base64), "base64");
  const comprimido = await sharp(buffer)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return comprimido.toString("base64");
}

async function establecerCampoImagen(form: URLSearchParams, indice: 1 | 2, imagen: EntradaImagen) {
  if ("url" in imagen) {
    form.set(`image_url${indice}`, imagen.url);
  } else {
    form.set(`image_base64_${indice}`, await comprimirParaFacepp(imagen.base64));
  }
}

function esperar(ms: number) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function llamarComparacion(imagen1: EntradaImagen, imagen2: EntradaImagen) {
  const form = new URLSearchParams();
  form.set("api_key", env.FACEPP_API_KEY!);
  form.set("api_secret", env.FACEPP_API_SECRET!);
  await establecerCampoImagen(form, 1, imagen1);
  await establecerCampoImagen(form, 2, imagen2);

  const respuesta = await fetch(`${env.FACEPP_API_BASE}/facepp/v3/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  return { respuesta, datos };
}

// Compara dos rostros (cada uno dado como base64 o una URL alojada) usando
// Face++ (facepp.com) — un modelo genérico de comparación facial, no una
// coincidencia biométrica oficial de RENIEC (ese nivel de acceso no se
// vende a desarrolladores individuales). La confianza se compara contra el
// umbral propio de Face++ de tasa de falsos positivos "1e-4", su barra
// recomendada para casos de uso sensibles a la seguridad.
export async function compareFaces(imagen1: EntradaImagen, imagen2: EntradaImagen): Promise<FaceCompareResult> {
  if (!env.FACEPP_API_KEY || !env.FACEPP_API_SECRET) {
    throw new ErrorHttp(503, "El servicio de verificación facial no está configurado");
  }

  let { respuesta, datos } = await llamarComparacion(imagen1, imagen2);

  // El plan de Face++ en uso solo admite una solicitud a la vez — si dos
  // llegan solapadas (p. ej. el usuario cancela y reintenta muy rápido),
  // responde con este error puntual y transitorio. Un solo reintento tras
  // una breve espera resuelve la gran mayoría de estos casos.
  if (datos.error_message === "CONCURRENCY_LIMIT_EXCEEDED") {
    await esperar(1200);
    ({ respuesta, datos } = await llamarComparacion(imagen1, imagen2));
  }

  if (!respuesta.ok || typeof datos.error_message === "string") {
    console.error("Error de Face++:", respuesta.status, datos.error_message);
    throw new ErrorHttp(502, "El servicio de verificación facial no está disponible", {
      faceppError: typeof datos.error_message === "string" ? datos.error_message : `HTTP ${respuesta.status}`,
    });
  }

  if (typeof datos.confidence !== "number") {
    throw new ErrorHttp(422, "No se detectó un rostro claro en una de las fotos, intenta de nuevo con mejor iluminación");
  }

  const umbrales = datos.thresholds as Record<string, number> | undefined;
  const umbral = umbrales?.["1e-4"] ?? 75;

  return { matched: datos.confidence >= umbral, confidence: datos.confidence, threshold: umbral };
}
