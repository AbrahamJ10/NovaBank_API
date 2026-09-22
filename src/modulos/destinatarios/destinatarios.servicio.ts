import { Prisma } from "@prisma/client";
import { prisma } from "../../libreria/prisma";

type Db = typeof prisma | Prisma.TransactionClient;

function inicialesDe(nombre: string) {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "NB"
  );
}

// Una cuenta recién creada no tiene historial real de transferencias del
// cual sugerir beneficiarios, así que empieza con algunos a modo de
// ejemplo — incluyendo uno marcado como inactivo, para que el camino de
// "cuenta destino rechazada" siga siendo alcanzable y probable sin tener
// que fabricar ese estado a mano.
export async function sembrarBeneficiariosPorDefecto(db: Db, idUsuario: string) {
  await db.payee.createMany({
    data: [
      { userId: idUsuario, name: "Marco Salazar", bank: "BCP", accountNumber: "···8841", initials: "MS", inactive: false },
      { userId: idUsuario, name: "Camila Ríos", bank: "Interbank", accountNumber: "···2290", initials: "CR", inactive: false },
      { userId: idUsuario, name: "Cuenta de prueba", bank: "BBVA", accountNumber: "···0000", initials: "CP", inactive: true },
    ],
  });
}

export async function listarBeneficiarios(idUsuario: string) {
  return prisma.payee.findMany({ where: { userId: idUsuario }, orderBy: { createdAt: "asc" } });
}

export async function crearBeneficiario(idUsuario: string, entrada: { name: string; bank: string; accountNumber: string }) {
  return prisma.payee.create({
    data: {
      userId: idUsuario,
      name: entrada.name.trim(),
      bank: entrada.bank.trim(),
      accountNumber: entrada.accountNumber.trim(),
      initials: inicialesDe(entrada.name),
    },
  });
}
