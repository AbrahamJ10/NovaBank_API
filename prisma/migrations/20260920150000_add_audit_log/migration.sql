-- CreateEnum
CREATE TYPE "categoria_auditoria" AS ENUM ('SESION', 'NAVEGACION', 'TRANSFERENCIA', 'PAGO_SERVICIO', 'RETIRO', 'TARJETA', 'QR', 'PERFIL', 'SEGURIDAD');

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "categoria" "categoria_auditoria" NOT NULL,
    "accion" TEXT NOT NULL,
    "exitoso" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "metadatos" JSONB,
    "pantalla" TEXT,
    "ip" TEXT,
    "pais" TEXT,
    "ciudad" TEXT,
    "dispositivo" TEXT,
    "plataforma" TEXT,
    "version_app" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_creado_en_idx" ON "auditoria"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "auditoria_categoria_creado_en_idx" ON "auditoria"("categoria", "creado_en");

-- CreateIndex
CREATE INDEX "auditoria_accion_idx" ON "auditoria"("accion");

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
