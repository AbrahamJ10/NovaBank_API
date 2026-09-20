-- AlterTable
ALTER TABLE "cuentas" ADD COLUMN "cvv_tarjeta" TEXT NOT NULL DEFAULT '000';
ALTER TABLE "cuentas" ALTER COLUMN "cvv_tarjeta" DROP DEFAULT;
