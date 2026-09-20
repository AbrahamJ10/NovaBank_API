-- DropIndex
DROP INDEX "servicios_usuario_id_pagado_idx";

-- CreateIndex
CREATE INDEX "servicios_usuario_id_pagado_fecha_vencimiento_idx" ON "servicios"("usuario_id", "pagado", "fecha_vencimiento");

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_proveedor_fkey" FOREIGN KEY ("proveedor") REFERENCES "proveedores_servicio"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
