-- AlterEnum
ALTER TYPE "proposito_otp" ADD VALUE 'TRANSFER';

-- CreateTable
CREATE TABLE "beneficiarios" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "numero_cuenta" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "inactive" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beneficiarios_usuario_id_idx" ON "beneficiarios"("usuario_id");

-- AddForeignKey
ALTER TABLE "beneficiarios" ADD CONSTRAINT "beneficiarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
