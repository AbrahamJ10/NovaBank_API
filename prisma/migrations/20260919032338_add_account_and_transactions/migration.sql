-- CreateEnum
CREATE TYPE "tipo_transaccion" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "categoria_transaccion" AS ENUM ('COMPRAS', 'TRANSFERENCIAS', 'QR', 'INGRESOS', 'RETIROS', 'SERVICIOS');

-- AlterTable
ALTER TABLE "codigos_verificacion" RENAME CONSTRAINT "email_otps_pkey" TO "codigos_verificacion_pkey";

-- AlterTable
ALTER TABLE "eventos_inicio_sesion" RENAME CONSTRAINT "login_events_pkey" TO "eventos_inicio_sesion_pkey";

-- AlterTable
ALTER TABLE "eventos_verificacion_facial" RENAME CONSTRAINT "face_verification_events_pkey" TO "eventos_verificacion_facial_pkey";

-- AlterTable
ALTER TABLE "referencias_faciales" RENAME CONSTRAINT "face_references_pkey" TO "referencias_faciales_pkey";

-- AlterTable
ALTER TABLE "tokens_renovacion" RENAME CONSTRAINT "refresh_tokens_pkey" TO "tokens_renovacion_pkey";

-- AlterTable
ALTER TABLE "usuarios" RENAME CONSTRAINT "users_pkey" TO "usuarios_pkey";

-- CreateTable
CREATE TABLE "cuentas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "numero_cuenta" TEXT NOT NULL,
    "cci" TEXT NOT NULL,
    "numero_tarjeta" TEXT NOT NULL,
    "vencimiento_tarjeta" TEXT NOT NULL,
    "saldo_disponible" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo_retenido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "linea_credito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deuda_tarjeta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dia_corte" INTEGER NOT NULL DEFAULT 28,
    "tarjeta_bloqueada" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "tipo" "tipo_transaccion" NOT NULL,
    "categoria" "categoria_transaccion" NOT NULL,
    "nombre" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "icon" TEXT NOT NULL,
    "icono_fondo" TEXT NOT NULL,
    "icono_color" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_usuario_id_key" ON "cuentas"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_numero_cuenta_key" ON "cuentas"("numero_cuenta");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_cci_key" ON "cuentas"("cci");

-- CreateIndex
CREATE INDEX "transacciones_cuenta_id_creado_en_idx" ON "transacciones"("cuenta_id", "creado_en");

-- RenameForeignKey
ALTER TABLE "eventos_inicio_sesion" RENAME CONSTRAINT "login_events_userId_fkey" TO "eventos_inicio_sesion_usuario_id_fkey";

-- RenameForeignKey
ALTER TABLE "referencias_faciales" RENAME CONSTRAINT "face_references_userId_fkey" TO "referencias_faciales_usuario_id_fkey";

-- RenameForeignKey
ALTER TABLE "tokens_renovacion" RENAME CONSTRAINT "refresh_tokens_userId_fkey" TO "tokens_renovacion_usuario_id_fkey";

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "email_otps_email_purpose_idx" RENAME TO "codigos_verificacion_correo_proposito_idx";

-- RenameIndex
ALTER INDEX "login_events_email_idx" RENAME TO "eventos_inicio_sesion_correo_idx";

-- RenameIndex
ALTER INDEX "login_events_userId_idx" RENAME TO "eventos_inicio_sesion_usuario_id_idx";

-- RenameIndex
ALTER INDEX "face_verification_events_dni_idx" RENAME TO "eventos_verificacion_facial_dni_idx";

-- RenameIndex
ALTER INDEX "face_references_userId_key" RENAME TO "referencias_faciales_usuario_id_key";

-- RenameIndex
ALTER INDEX "refresh_tokens_tokenHash_key" RENAME TO "tokens_renovacion_token_hash_key";

-- RenameIndex
ALTER INDEX "refresh_tokens_userId_idx" RENAME TO "tokens_renovacion_usuario_id_idx";

-- RenameIndex
ALTER INDEX "users_dni_key" RENAME TO "usuarios_dni_key";

-- RenameIndex
ALTER INDEX "users_email_key" RENAME TO "usuarios_correo_key";

-- RenameIndex
ALTER INDEX "users_phone_key" RENAME TO "usuarios_telefono_key";
