-- AlterTable
ALTER TABLE "servicios" ADD COLUMN     "proveedor" TEXT NOT NULL,
ADD COLUMN     "numero_suministro" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "servicios_usuario_id_proveedor_numero_suministro_key" ON "servicios"("usuario_id", "proveedor", "numero_suministro");
