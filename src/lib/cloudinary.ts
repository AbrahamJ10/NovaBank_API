import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function toDataUri(base64: string) {
  return base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
}

// Guarda una foto de referencia facial (foto del DNI o selfie de
// verificación) para que un login con Face ID posterior pueda compararse
// contra ella. Cloudinary en vez de una columna base64 en Postgres —
// mantiene la base de datos pequeña y permite pedirle a Face++ que compare
// la imagen directo por URL en vez de volver a subirla.
export async function uploadFaceReference(base64: string, publicId: string): Promise<string> {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new HttpError(503, "El almacenamiento de fotos no está configurado");
  }

  const result = await cloudinary.uploader.upload(toDataUri(base64), {
    folder: "novabank/face-references",
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
  });

  return result.secure_url;
}
