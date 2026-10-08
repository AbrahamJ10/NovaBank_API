-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('CLIENTE', 'ADMIN');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "eliminado_en" TIMESTAMP(3),
ADD COLUMN     "rol" "rol_usuario" NOT NULL DEFAULT 'CLIENTE';
