-- AlterEnum
BEGIN;
CREATE TYPE "categoria_auditoria_new" AS ENUM ('SESION', 'NAVEGACION', 'TRANSFERENCIA', 'PAGO_SERVICIO', 'TARJETA', 'QR', 'PERFIL', 'SEGURIDAD');
ALTER TABLE "auditoria" ALTER COLUMN "categoria" TYPE "categoria_auditoria_new" USING ("categoria"::text::"categoria_auditoria_new");
ALTER TYPE "categoria_auditoria" RENAME TO "categoria_auditoria_old";
ALTER TYPE "categoria_auditoria_new" RENAME TO "categoria_auditoria";
DROP TYPE "public"."categoria_auditoria_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "categoria_transaccion_new" AS ENUM ('COMPRAS', 'TRANSFERENCIAS', 'QR', 'INGRESOS', 'SERVICIOS', 'PAGO_TARJETA');
ALTER TABLE "transacciones" ALTER COLUMN "categoria" TYPE "categoria_transaccion_new" USING ("categoria"::text::"categoria_transaccion_new");
ALTER TYPE "categoria_transaccion" RENAME TO "categoria_transaccion_old";
ALTER TYPE "categoria_transaccion_new" RENAME TO "categoria_transaccion";
DROP TYPE "public"."categoria_transaccion_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "retiros_sin_tarjeta" DROP CONSTRAINT "retiros_sin_tarjeta_cuenta_id_fkey";

-- DropForeignKey
ALTER TABLE "retiros_sin_tarjeta" DROP CONSTRAINT "retiros_sin_tarjeta_usuario_id_fkey";

-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "alerta_retiro";

-- DropTable
DROP TABLE "retiros_sin_tarjeta";

