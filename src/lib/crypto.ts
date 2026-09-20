import crypto from "crypto";
import { env } from "../config/env";

// At-rest encryption for sensitive fields (Account.cardNumber/cardCvv) — the
// DB itself is a shared Neon instance with no separate at-rest encryption
// guarantee, so this protects a raw DB dump from exposing real-looking card
// data. AES-256-GCM: random 12-byte IV per value, auth tag prevents tamper.
const ALGORITHM = "aes-256-gcm";
const key = Buffer.from(env.ENCRYPTION_KEY, "hex");

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload format");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
