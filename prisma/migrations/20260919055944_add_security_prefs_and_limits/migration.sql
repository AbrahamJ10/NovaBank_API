-- AlterTable
ALTER TABLE "cuentas" ADD COLUMN     "geo_internacional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "geo_peru" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "limite_cajero" DECIMAL(12,2) NOT NULL DEFAULT 700,
ADD COLUMN     "limite_en_linea" DECIMAL(12,2) NOT NULL DEFAULT 1500;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "alerta_compra" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alerta_login" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alerta_promo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alerta_retiro" BOOLEAN NOT NULL DEFAULT true;
