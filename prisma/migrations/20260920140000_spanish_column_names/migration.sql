-- Rename the remaining English-named columns to Spanish, for consistency
-- with the rest of the schema (which already maps table/column names to
-- Spanish). Pure renames, no data movement.

ALTER TABLE "transacciones" RENAME COLUMN "icon" TO "icono";
ALTER TABLE "notificaciones" RENAME COLUMN "icon" TO "icono";

ALTER TABLE "beneficiarios" RENAME COLUMN "name" TO "nombre";
ALTER TABLE "beneficiarios" RENAME COLUMN "bank" TO "banco";
ALTER TABLE "beneficiarios" RENAME COLUMN "initials" TO "iniciales";
ALTER TABLE "beneficiarios" RENAME COLUMN "inactive" TO "inactivo";

ALTER TABLE "proveedores_servicio" RENAME COLUMN "key" TO "clave";
ALTER TABLE "proveedores_servicio" RENAME COLUMN "name" TO "nombre";
ALTER TABLE "proveedores_servicio" RENAME COLUMN "category" TO "categoria";
ALTER TABLE "proveedores_servicio" RENAME COLUMN "icon" TO "icono";
ALTER TABLE "proveedores_servicio" RENAME COLUMN "active" TO "activo";

ALTER TABLE "servicios" RENAME COLUMN "name" TO "nombre";
ALTER TABLE "servicios" RENAME COLUMN "icon" TO "icono";
ALTER TABLE "servicios" RENAME COLUMN "amount" TO "monto";
ALTER TABLE "servicios" RENAME COLUMN "consumption" TO "consumo";

ALTER TABLE "retiros_sin_tarjeta" RENAME COLUMN "code" TO "codigo";
ALTER TABLE "retiros_sin_tarjeta" RENAME COLUMN "amount" TO "monto";
