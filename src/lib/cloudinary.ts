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

// Stores a face-reference photo (DNI photo or verification selfie) so a
// later Face ID login can compare against it. Cloudinary instead of a
// base64 column in Postgres — keeps the database small and lets us request
// Face++ compare the image straight by URL instead of re-uploading it.
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
