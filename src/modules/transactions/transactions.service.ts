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

// El único lugar donde se escribe una transacción — todo endpoint futuro
// que mueva dinero (transferencia, pago de recibo, QR, retiro) debe llamar
// a esto para que la fila del historial y su notificación se creen juntas,
// de forma atómica, dentro del mismo cliente db/tx que el cambio de saldo
// que las causó. La fila del historial nunca es opcional; `notification`
// sí lo es — quien llama y cuya categoría está controlada por una
// preferencia de notificación del usuario (ver User.alertPurchase/
// alertWithdraw) pasa null para omitirla ahí, mientras que la transacción
// en sí siempre se registra.
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
