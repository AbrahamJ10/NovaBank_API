import { prisma } from "../../lib/prisma";

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
