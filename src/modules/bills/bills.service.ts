import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";

type Db = typeof prisma | Prisma.TransactionClient;

const STARTER_BILLS = [
  { name: "Luz del Sur", meta: "Suministro 0084 2210", icon: "bolt", amount: 132.4, dueInDays: 12, consumption: "184 kWh" },
  { name: "Sedapal", meta: "Suministro 0021 8842", icon: "water-drop", amount: 58.1, dueInDays: 18, consumption: "12 m³" },
  { name: "Claro Perú", meta: "Línea 987 214 550", icon: "wifi", amount: 89.9, dueInDays: 22, consumption: "Plan ilimitado" },
];

// A brand-new account has no real billing history, so it starts with a
// few illustrative recurring bills — same role as seedDefaultPayees for
// transfers.
export async function seedDefaultBills(db: Db, userId: string) {
  const now = Date.now();
  await db.bill.createMany({
    data: STARTER_BILLS.map((b) => ({
      userId,
      name: b.name,
      meta: b.meta,
      icon: b.icon,
      amount: b.amount,
      dueDate: new Date(now + b.dueInDays * 24 * 60 * 60 * 1000),
      consumption: b.consumption,
    })),
  });
}

export async function listBills(userId: string) {
  return prisma.bill.findMany({ where: { userId, paid: false }, orderBy: { dueDate: "asc" } });
}

export async function payBill(userId: string, billId: string) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, userId } });
  if (!bill) throw new HttpError(404, "Servicio no encontrado");
  if (bill.paid) throw new HttpError(409, "Este servicio ya fue pagado");

  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  const amount = Number(bill.amount);
  if (Number(account.availableBalance) < amount) {
    throw new HttpError(400, "Saldo insuficiente");
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId }, data: { availableBalance: { decrement: amount } } });
    await tx.bill.update({ where: { id: bill.id }, data: { paid: true, paidAt: new Date() } });
    // The next billing cycle starts right away, same as a real recurring
    // service — otherwise the feature would only ever work once per account.
    await tx.bill.create({
      data: {
        userId,
        name: bill.name,
        meta: bill.meta,
        icon: bill.icon,
        amount: bill.amount,
        dueDate: new Date(bill.dueDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        consumption: bill.consumption,
      },
    });
    await recordTransaction(
      tx,
      userId,
      account.id,
      {
        kind: "DEBIT",
        category: "SERVICIOS",
        name: bill.name,
        meta: "Pago de servicio",
        amount,
        icon: bill.icon,
        iconBg: "#FFF9EC",
        iconFg: "#B07D07",
      },
      {
        title: "Servicio pagado",
        body: `Pagaste ${bill.name} por S/ ${amount.toFixed(2)}.`,
        icon: bill.icon,
        iconBg: "#FFF9EC",
        iconFg: "#B07D07",
      }
    );
  });
}
