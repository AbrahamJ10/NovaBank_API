-- CreateEnum
CREATE TYPE "categoria_proveedor" AS ENUM ('LUZ', 'AGUA', 'GAS', 'MOVIL', 'CABLE', 'BANCO', 'SEGURO', 'EDUCACION', 'MUNICIPALIDAD');

-- CreateTable
CREATE TABLE "proveedores_servicio" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "categoria_proveedor" NOT NULL,
    "icon" TEXT NOT NULL,
    "icono_fondo" TEXT NOT NULL,
    "icono_color" TEXT NOT NULL,
    "etiqueta_campo" TEXT NOT NULL,
    "placeholder_campo" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_servicio_key_key" ON "proveedores_servicio"("key");
