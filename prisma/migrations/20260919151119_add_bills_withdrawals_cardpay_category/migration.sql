-- AlterEnum
ALTER TYPE "categoria_transaccion" ADD VALUE 'PAGO_TARJETA';

-- CreateTable
CREATE TABLE "servicios" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "consumption" TEXT,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "pagado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retiros_sin_tarjeta" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "cancelado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retiros_sin_tarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servicios_usuario_id_pagado_idx" ON "servicios"("usuario_id", "pagado");

-- CreateIndex
CREATE UNIQUE INDEX "retiros_sin_tarjeta_code_key" ON "retiros_sin_tarjeta"("code");

-- CreateIndex
CREATE INDEX "retiros_sin_tarjeta_usuario_id_idx" ON "retiros_sin_tarjeta"("usuario_id");

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_sin_tarjeta" ADD CONSTRAINT "retiros_sin_tarjeta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_sin_tarjeta" ADD CONSTRAINT "retiros_sin_tarjeta_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
