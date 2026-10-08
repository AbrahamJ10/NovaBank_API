-- CreateEnum
CREATE TYPE "categoria_caso_seguridad" AS ENUM ('FRAUDE', 'CUENTA_COMPROMETIDA', 'ACTIVIDAD_SOSPECHOSA', 'OTRO');

-- CreateEnum
CREATE TYPE "estado_caso_seguridad" AS ENUM ('ABIERTO', 'EN_REVISION', 'CERRADO');

-- CreateEnum
CREATE TYPE "prioridad_caso" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateTable
CREATE TABLE "acciones_admin" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "usuario_afectado_id" TEXT,
    "accion" TEXT NOT NULL,
    "valores_antes" JSONB,
    "valores_despues" JSONB,
    "descripcion" TEXT,
    "ip" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acciones_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_usuario" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casos_seguridad" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "categoria" "categoria_caso_seguridad" NOT NULL,
    "estado" "estado_caso_seguridad" NOT NULL DEFAULT 'ABIERTO',
    "prioridad" "prioridad_caso" NOT NULL DEFAULT 'MEDIA',
    "descripcion" TEXT NOT NULL,
    "resolucion" TEXT,
    "admin_asignado_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "cerrado_en" TIMESTAMP(3),

    CONSTRAINT "casos_seguridad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_cambios" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "admin_id" TEXT,
    "campo" TEXT NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_cambios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acciones_admin_admin_id_creado_en_idx" ON "acciones_admin"("admin_id", "creado_en");

-- CreateIndex
CREATE INDEX "acciones_admin_usuario_afectado_id_creado_en_idx" ON "acciones_admin"("usuario_afectado_id", "creado_en");

-- CreateIndex
CREATE INDEX "notas_usuario_usuario_id_creado_en_idx" ON "notas_usuario"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "casos_seguridad_usuario_id_idx" ON "casos_seguridad"("usuario_id");

-- CreateIndex
CREATE INDEX "casos_seguridad_estado_idx" ON "casos_seguridad"("estado");

-- CreateIndex
CREATE INDEX "historial_cambios_usuario_id_creado_en_idx" ON "historial_cambios"("usuario_id", "creado_en");

-- AddForeignKey
ALTER TABLE "acciones_admin" ADD CONSTRAINT "acciones_admin_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acciones_admin" ADD CONSTRAINT "acciones_admin_usuario_afectado_id_fkey" FOREIGN KEY ("usuario_afectado_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_usuario" ADD CONSTRAINT "notas_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_usuario" ADD CONSTRAINT "notas_usuario_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos_seguridad" ADD CONSTRAINT "casos_seguridad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos_seguridad" ADD CONSTRAINT "casos_seguridad_admin_asignado_id_fkey" FOREIGN KEY ("admin_asignado_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_cambios" ADD CONSTRAINT "historial_cambios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_cambios" ADD CONSTRAINT "historial_cambios_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

