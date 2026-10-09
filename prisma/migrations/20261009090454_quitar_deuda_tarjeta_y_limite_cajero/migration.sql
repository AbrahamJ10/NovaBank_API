-- AlterEnum
BEGIN;
CREATE TYPE "categoria_transaccion_new" AS ENUM ('COMPRAS', 'TRANSFERENCIAS', 'QR', 'INGRESOS', 'SERVICIOS');
ALTER TABLE "transacciones" ALTER COLUMN "categoria" TYPE "categoria_transaccion_new" USING ("categoria"::text::"categoria_transaccion_new");
ALTER TYPE "categoria_transaccion" RENAME TO "categoria_transaccion_old";
ALTER TYPE "categoria_transaccion_new" RENAME TO "categoria_transaccion";
DROP TYPE "public"."categoria_transaccion_old";
COMMIT;

-- AlterTable
ALTER TABLE "cuentas" DROP COLUMN "deuda_tarjeta",
DROP COLUMN "limite_cajero";

