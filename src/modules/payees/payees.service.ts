import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type Db = typeof prisma | Prisma.TransactionClient;

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "NB"
  );
}

// Una cuenta recién creada no tiene historial real de transferencias del
// cual sugerir beneficiarios, así que empieza con algunos a modo de
// ejemplo — incluyendo uno marcado como inactivo, para que el camino de
// "cuenta destino rechazada" siga siendo alcanzable y probable sin tener
// que fabricar ese estado a mano.
export async function seedDefaultPayees(db: Db, userId: string) {
  await db.payee.createMany({
    data: [
      { userId, name: "Marco Salazar", bank: "BCP", accountNumber: "···8841", initials: "MS", inactive: false },
      { userId, name: "Camila Ríos", bank: "Interbank", accountNumber: "···2290", initials: "CR", inactive: false },
      { userId, name: "Cuenta de prueba", bank: "BBVA", accountNumber: "···0000", initials: "CP", inactive: true },
    ],
  });
}

export async function listPayees(userId: string) {
  return prisma.payee.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function createPayee(userId: string, input: { name: string; bank: string; accountNumber: string }) {
  return prisma.payee.create({
    data: {
      userId,
      name: input.name.trim(),
      bank: input.bank.trim(),
      accountNumber: input.accountNumber.trim(),
      initials: initialsOf(input.name),
    },
  });
}
