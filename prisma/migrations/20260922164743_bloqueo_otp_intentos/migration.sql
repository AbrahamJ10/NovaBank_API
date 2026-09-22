-- CreateTable
CREATE TABLE "bloqueos_otp" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "proposito" "proposito_otp" NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bloqueos_otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bloqueos_otp_correo_proposito_key" ON "bloqueos_otp"("correo", "proposito");

-- RenameIndex
ALTER INDEX "proveedores_servicio_key_key" RENAME TO "proveedores_servicio_clave_key";

-- RenameIndex
ALTER INDEX "retiros_sin_tarjeta_code_key" RENAME TO "retiros_sin_tarjeta_codigo_key";
