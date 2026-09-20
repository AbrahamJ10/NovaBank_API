import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";
import type { PayQrInput } from "./qr.validators";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

export async function payQr(userId: string, input: PayQrInput, meta?: RequestMeta) {
  const [account, user] = await Promise.all([
    prisma.account.findUnique({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);
  if (!account) throw new HttpError(404, "Cuenta no encontrada");
  if (Number(account.availableBalance) < input.amount) {
    await recordAudit({
      userId,
      category: "QR",
      action: "qr_payment_failed_insufficient_balance",
      success: false,
      metadata: { merchant: input.merchant, amount: input.amount },
      meta,
    });
    throw new HttpError(400, "Saldo insuficiente");
  }

  const transaction = await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId }, data: { availableBalance: { decrement: input.amount } } });
    return recordTransaction(
      tx,
      userId,
      account.id,
      {
        kind: "DEBIT",
        category: "QR",
        name: input.merchant,
        meta: "Pago QR",
        amount: input.amount,
        icon: "qr-code-2",
        iconBg: "#FFF1E8",
        iconFg: "#D2691E",
      },
      user.alertPurchase
        ? {
            title: "Pago con QR",
            body: `Pagaste S/ ${input.amount.toFixed(2)} a ${input.merchant}.`,
            icon: "qr-code-2",
            iconBg: "#FFF1E8",
            iconFg: "#D2691E",
          }
        : null
    );
  });

  await recordAudit({
    userId,
    category: "QR",
    action: "qr_payment_completed",
    metadata: { merchant: input.merchant, amount: input.amount },
    meta,
  });

  return { transactionId: transaction.id, merchant: input.merchant, amount: input.amount, createdAt: transaction.createdAt };
}
