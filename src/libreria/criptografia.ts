import crypto from "crypto";
import { env } from "../configuracion/entorno";

// Cifrado en reposo para campos sensibles (Account.cardNumber/cardCvv) — la
// base de datos en sí es una instancia compartida de Neon sin garantía
// aparte de cifrado en reposo, así que esto protege que un volcado crudo de
// la base de datos exponga datos de tarjeta que parezcan reales.
// AES-256-GCM: IV aleatorio de 12 bytes por valor, el auth tag evita
// manipulación.
const ALGORITHM = "aes-256-gcm";
const key = Buffer.from(env.ENCRYPTION_KEY, "hex");

export function cifrar(textoPlano: string): string {
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv(ALGORITHM, key, iv);
  const textoCifrado = Buffer.concat([cifrador.update(textoPlano, "utf8"), cifrador.final()]);
  const authTag = cifrador.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), textoCifrado.toString("base64")].join(".");
}

export function descifrar(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Formato de payload cifrado inválido");
  const descifrador = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  descifrador.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([descifrador.update(Buffer.from(dataB64, "base64")), descifrador.final()]).toString("utf8");
}
