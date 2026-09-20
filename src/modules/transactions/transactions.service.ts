import { Prisma, TransactionCategory, TransactionKind } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createNotification, NotificationInput } from "../notifications/notifications.service";

type Db = typeof prisma | Prisma.TransactionClient;

export type NewTransactionInput = {
  kind: TransactionKind;
  category: TransactionCategory;
  name: string;
  meta: string;
  amount: number;
  icon: string;
  iconBg: string;
  iconFg: string;
};

// The one place a transaction gets written — every future money-moving
// endpoint (transfer, bill pay, QR, withdrawal) should call this so the
// ledger row and its notification are created together, atomically, inside
// the same db/tx client as the balance update that caused it. The ledger
// row is never optional; `notification` is — callers whose category is
// gated by a user notification preference (see User.alertPurchase/
// alertWithdraw) pass null to skip it there instead of unconditionally
// creating one, while the transaction itself still always records.
export async function recordTransaction(
  db: Db,
  userId: string,
  accountId: string,
  input: NewTransactionInput,
  notification: NotificationInput | null
) {
  const transaction = await db.transaction.create({
    data: {
      accountId,
      kind: input.kind,
      category: input.category,
      name: input.name,
      meta: input.meta,
      amount: input.amount,
      icon: input.icon,
      iconBg: input.iconBg,
      iconFg: input.iconFg,
    },
  });
  if (notification) {
    await createNotification(db, userId, notification);
  }
  return transaction;
}

export async function listTransactions(userId: string, limit = 50) {
  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) return [];

  const items = await prisma.transaction.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return items.map((t) => ({
    id: t.id,
    name: t.name,
    meta: t.meta,
    amount: Number(t.amount),
    kind: t.kind.toLowerCase() as "credit" | "debit",
    category: t.category.toLowerCase(),
    icon: t.icon,
    iconBg: t.iconBg,
    iconFg: t.iconFg,
    createdAt: t.createdAt,
  }));
}
