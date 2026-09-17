-- Rename physical tables/columns to Spanish for a clearer ER diagram.
-- Hand-written as pure RENAME statements (not Prisma's auto-diff) so this
-- is guaranteed to preserve all existing data — no column/table is ever
-- dropped or recreated, only renamed. Prisma model/field names in the
-- application code are unchanged (schema.prisma now maps them to these
-- new physical names via @map/@@map).

-- users -> usuarios
ALTER TABLE "users" RENAME COLUMN "email" TO "correo";
ALTER TABLE "users" RENAME COLUMN "phone" TO "telefono";
ALTER TABLE "users" RENAME COLUMN "fullName" TO "nombre_completo";
ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "contrasena_hash";
ALTER TABLE "users" RENAME COLUMN "isActive" TO "esta_activo";
ALTER TABLE "users" RENAME COLUMN "failedLoginAttempts" TO "intentos_fallidos";
ALTER TABLE "users" RENAME COLUMN "lockedUntil" TO "bloqueado_hasta";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "creado_en";
ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "actualizado_en";
ALTER TABLE "users" RENAME TO "usuarios";

-- refresh_tokens -> tokens_renovacion
ALTER TABLE "refresh_tokens" RENAME COLUMN "userId" TO "usuario_id";
ALTER TABLE "refresh_tokens" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "refresh_tokens" RENAME COLUMN "userAgent" TO "agente_usuario";
ALTER TABLE "refresh_tokens" RENAME COLUMN "expiresAt" TO "expira_en";
ALTER TABLE "refresh_tokens" RENAME COLUMN "revokedAt" TO "revocado_en";
ALTER TABLE "refresh_tokens" RENAME COLUMN "replacedByTokenHash" TO "reemplazado_por_token_hash";
ALTER TABLE "refresh_tokens" RENAME COLUMN "createdAt" TO "creado_en";
ALTER TABLE "refresh_tokens" RENAME TO "tokens_renovacion";

-- login_events -> eventos_inicio_sesion
ALTER TABLE "login_events" RENAME COLUMN "userId" TO "usuario_id";
ALTER TABLE "login_events" RENAME COLUMN "email" TO "correo";
ALTER TABLE "login_events" RENAME COLUMN "result" TO "resultado";
ALTER TABLE "login_events" RENAME COLUMN "userAgent" TO "agente_usuario";
ALTER TABLE "login_events" RENAME COLUMN "createdAt" TO "creado_en";
ALTER TABLE "login_events" RENAME TO "eventos_inicio_sesion";

-- email_otps -> codigos_verificacion
ALTER TABLE "email_otps" RENAME COLUMN "email" TO "correo";
ALTER TABLE "email_otps" RENAME COLUMN "purpose" TO "proposito";
ALTER TABLE "email_otps" RENAME COLUMN "codeHash" TO "codigo_hash";
ALTER TABLE "email_otps" RENAME COLUMN "attempts" TO "intentos";
ALTER TABLE "email_otps" RENAME COLUMN "expiresAt" TO "expira_en";
ALTER TABLE "email_otps" RENAME COLUMN "consumedAt" TO "consumido_en";
ALTER TABLE "email_otps" RENAME COLUMN "createdAt" TO "creado_en";
ALTER TABLE "email_otps" RENAME TO "codigos_verificacion";

-- face_references -> referencias_faciales
ALTER TABLE "face_references" RENAME COLUMN "userId" TO "usuario_id";
ALTER TABLE "face_references" RENAME COLUMN "dniPhotoUrl" TO "foto_dni_url";
ALTER TABLE "face_references" RENAME COLUMN "selfiePhotoUrl" TO "foto_selfie_url";
ALTER TABLE "face_references" RENAME COLUMN "createdAt" TO "creado_en";
ALTER TABLE "face_references" RENAME COLUMN "updatedAt" TO "actualizado_en";
ALTER TABLE "face_references" RENAME TO "referencias_faciales";

-- face_verification_events -> eventos_verificacion_facial
ALTER TABLE "face_verification_events" RENAME COLUMN "matched" TO "coincidio";
ALTER TABLE "face_verification_events" RENAME COLUMN "confidence" TO "confianza";
ALTER TABLE "face_verification_events" RENAME COLUMN "userAgent" TO "agente_usuario";
ALTER TABLE "face_verification_events" RENAME COLUMN "createdAt" TO "creado_en";
ALTER TABLE "face_verification_events" RENAME TO "eventos_verificacion_facial";

-- enum type names (values, e.g. 'SUCCESS'/'REGISTER', are left as-is)
ALTER TYPE "LoginEventResult" RENAME TO "resultado_inicio_sesion";
ALTER TYPE "OtpPurpose" RENAME TO "proposito_otp";
