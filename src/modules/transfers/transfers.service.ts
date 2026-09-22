import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";
import { requestTransferOtp, verifyTransferOtp } from "../verification/otp.service";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

export type ExecuteTransferInput = {
  payeeId: string;
  amount: number;
  concept: string;
  otpCode: string;
};

function generateReference() {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  return `NV-${100 + rnd(900)} ${1000 + rnd(9000)} ${1000 + rnd(9000)}`;
}

export async function requestTransfer(email: string) {
  await requestTransferOtp(email);
}

export async function executeTransfer(userId: string, email: string, input: ExecuteTransferInput, meta?: RequestMeta) {
  // Verificar el código primero significa que uno incorrecto/expirado nunca
  // llega a revelar si la cuenta destino existe o tiene saldo suficiente.
  await verifyTransferOtp(email, input.otpCode);

  const [payee, account] = await Promise.all([
    prisma.payee.findFirst({ where: { id: input.payeeId, userId } }),
    prisma.account.findUnique({ where: { userId } }),
  ]);

  if (!payee) throw new HttpError(404, "Beneficiario no encontrado");
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  // Refleja las razones de rechazo reales de un banco (destino
  // cerrado/congelado) en vez de tener éxito en silencio — el saldo del
  // remitente queda intacto.
  if (payee.inactive) {
    await recordAudit({
      userId,
      category: "TRANSFERENCIA",
      action: "transfer_failed_inactive_payee",
      success: false,
      metadata: { payeeId: payee.id, payeeName: payee.name, amount: input.amount },
      meta,
    });
    throw new HttpError(422, "La cuenta destino está inactiva", {
      reasonCode: "R-3204",
      reasonLabel: "Cuenta destino inactiva",
    });
  }

  if (input.amount <= 0) {
    throw new HttpError(400, "El monto debe ser mayor a cero");
  }
  if (Number(account.availableBalance) < input.amount) {
    await recordAudit({
      userId,
      category: "TRANSFERENCIA",
      action: "transfer_failed_insufficient_balance",
      success: false,
      metadata: { payeeId: payee.id, payeeName: payee.name, amount: input.amount },
      meta,
    });
    throw new HttpError(400, "Saldo insuficiente");
  }

  // Ventana móvil de 24h en vez de un día calendario — evita los casos
  // límite de zona horaria alrededor de la medianoche, manteniendo en la
  // práctica el sentido de "límite diario".
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentRecently = await prisma.transaction.aggregate({
    where: { accountId: account.id, category: "TRANSFERENCIAS", kind: "DEBIT", createdAt: { gte: since } },
    _sum: { amount: true },
  });
  const alreadySent = Number(sentRecently._sum.amount ?? 0);
  const limitOnline = Number(account.limitOnline);
  if (alreadySent + input.amount > limitOnline) {
    await recordAudit({
      userId,
      category: "TRANSFERENCIA",
      action: "transfer_failed_limit_exceeded",
      success: false,
      metadata: { payeeId: payee.id, payeeName: payee.name, amount: input.amount, limitOnline },
      meta,
    });
    throw new HttpError(422, "Superaste tu límite de transferencias en línea", {
      reasonCode: "R-LIMIT",
      reasonLabel: `Límite diario de S/ ${limitOnline.toFixed(2)} superado`,
    });
  }

  const transaction = await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { userId },
      data: { availableBalance: { decrement: input.amount } },
    });

    return recordTransaction(
      tx,
      userId,
      account.id,
      {
        kind: "DEBIT",
        category: "TRANSFERENCIAS",
        name: payee.name,
        meta: `Transferencia ${payee.bank} ${payee.accountNumber}`,
        amount: input.amount,
        icon: "arrow-upward",
        iconBg: "#EDF2F8",
        iconFg: "#133A63",
      },
      {
        title: "Transferencia enviada",
        body: `Enviaste S/ ${input.amount.toFixed(2)} a ${payee.name} (${payee.bank}).`,
        icon: "arrow-upward",
        iconBg: "#EDF2F8",
        iconFg: "#133A63",
      }
    );
  });

  await recordAudit({
    userId,
    category: "TRANSFERENCIA",
    action: "transfer_completed",
    metadata: {
      payeeId: payee.id,
      payeeName: payee.name,
      payeeBank: payee.bank,
      payeeAccount: payee.accountNumber,
      amount: input.amount,
      concept: input.concept,
    },
    meta,
  });

  return {
    transactionId: transaction.id,
    amount: input.amount,
    concept: input.concept,
    payee: { name: payee.name, bank: payee.bank, accountNumber: payee.accountNumber },
    reference: generateReference(),
    createdAt: transaction.createdAt,
  };
}
