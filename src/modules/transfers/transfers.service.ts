import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";
import { requestTransferOtp, verifyTransferOtp } from "../verification/otp.service";

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

export async function executeTransfer(userId: string, email: string, input: ExecuteTransferInput) {
  // Verifying the code first means a wrong/expired code never even reveals
  // whether the destination account exists or has enough balance behind it.
  await verifyTransferOtp(email, input.otpCode);

  const [payee, account] = await Promise.all([
    prisma.payee.findFirst({ where: { id: input.payeeId, userId } }),
    prisma.account.findUnique({ where: { userId } }),
  ]);

  if (!payee) throw new HttpError(404, "Beneficiario no encontrado");
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  // Mirrors a real bank's own rejection reasons (closed/frozen destination)
  // instead of silently succeeding — the sender's balance stays untouched.
  if (payee.inactive) {
    throw new HttpError(422, "La cuenta destino está inactiva", {
      reasonCode: "R-3204",
      reasonLabel: "Cuenta destino inactiva",
    });
  }

  if (input.amount <= 0) {
    throw new HttpError(400, "El monto debe ser mayor a cero");
  }
  if (Number(account.availableBalance) < input.amount) {
    throw new HttpError(400, "Saldo insuficiente");
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

  return {
    transactionId: transaction.id,
    amount: input.amount,
    concept: input.concept,
    payee: { name: payee.name, bank: payee.bank, accountNumber: payee.accountNumber },
    reference: generateReference(),
    createdAt: transaction.createdAt,
  };
}
