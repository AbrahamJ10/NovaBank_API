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

// A brand-new account has no real transfer history to suggest beneficiaries
// from, so it starts with a few illustrative ones — including one marked
// inactive, so the "destination account rejected" path stays reachable and
// testable without needing to fabricate that state by hand.
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
