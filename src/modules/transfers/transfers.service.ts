import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";
import { requestTransferOtp, verifyTransferOtp } from "../verification/otp.service";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

export type EntradaEjecutarTransferencia = {
  payeeId: string;
  amount: number;
  concept: string;
  otpCode: string;
};

function generarReferencia() {
  const aleatorio = (n: number) => Math.floor(Math.random() * n);
  return `NV-${100 + aleatorio(900)} ${1000 + aleatorio(9000)} ${1000 + aleatorio(9000)}`;
}

export async function solicitarTransferencia(correo: string) {
  await requestTransferOtp(correo);
}

export async function ejecutarTransferencia(idUsuario: string, correo: string, entrada: EntradaEjecutarTransferencia, metaSolicitud?: RequestMeta) {
  // Verificar el código primero significa que uno incorrecto/expirado nunca
  // llega a revelar si la cuenta destino existe o tiene saldo suficiente.
  await verifyTransferOtp(correo, entrada.otpCode);

  const [beneficiario, cuenta] = await Promise.all([
    prisma.payee.findFirst({ where: { id: entrada.payeeId, userId: idUsuario } }),
    prisma.account.findUnique({ where: { userId: idUsuario } }),
  ]);

  if (!beneficiario) throw new HttpError(404, "Beneficiario no encontrado");
  if (!cuenta) throw new HttpError(404, "Cuenta no encontrada");

  // Refleja las razones de rechazo reales de un banco (destino
  // cerrado/congelado) en vez de tener éxito en silencio — el saldo del
  // remitente queda intacto.
  if (beneficiario.inactive) {
    await recordAudit({
      userId: idUsuario,
      category: "TRANSFERENCIA",
      action: "transfer_failed_inactive_payee",
      success: false,
      metadata: { payeeId: beneficiario.id, payeeName: beneficiario.name, amount: entrada.amount },
      meta: metaSolicitud,
    });
    throw new HttpError(422, "La cuenta destino está inactiva", {
      reasonCode: "R-3204",
      reasonLabel: "Cuenta destino inactiva",
    });
  }

  if (entrada.amount <= 0) {
    throw new HttpError(400, "El monto debe ser mayor a cero");
  }
  if (Number(cuenta.availableBalance) < entrada.amount) {
    await recordAudit({
      userId: idUsuario,
      category: "TRANSFERENCIA",
      action: "transfer_failed_insufficient_balance",
      success: false,
      metadata: { payeeId: beneficiario.id, payeeName: beneficiario.name, amount: entrada.amount },
      meta: metaSolicitud,
    });
    throw new HttpError(400, "Saldo insuficiente");
  }

  // Ventana móvil de 24h en vez de un día calendario — evita los casos
  // límite de zona horaria alrededor de la medianoche, manteniendo en la
  // práctica el sentido de "límite diario".
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const enviadoRecientemente = await prisma.transaction.aggregate({
    where: { accountId: cuenta.id, category: "TRANSFERENCIAS", kind: "DEBIT", createdAt: { gte: desde } },
    _sum: { amount: true },
  });
  const yaEnviado = Number(enviadoRecientemente._sum.amount ?? 0);
  const limiteEnLinea = Number(cuenta.limitOnline);
  if (yaEnviado + entrada.amount > limiteEnLinea) {
    await recordAudit({
      userId: idUsuario,
      category: "TRANSFERENCIA",
      action: "transfer_failed_limit_exceeded",
      success: false,
      metadata: { payeeId: beneficiario.id, payeeName: beneficiario.name, amount: entrada.amount, limitOnline: limiteEnLinea },
      meta: metaSolicitud,
    });
    throw new HttpError(422, "Superaste tu límite de transferencias en línea", {
      reasonCode: "R-LIMIT",
      reasonLabel: `Límite diario de S/ ${limiteEnLinea.toFixed(2)} superado`,
    });
  }

  const transaccion = await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { userId: idUsuario },
      data: { availableBalance: { decrement: entrada.amount } },
    });

    return recordTransaction(
      tx,
      idUsuario,
      cuenta.id,
      {
        kind: "DEBIT",
        category: "TRANSFERENCIAS",
        name: beneficiario.name,
        meta: `Transferencia ${beneficiario.bank} ${beneficiario.accountNumber}`,
        amount: entrada.amount,
        icon: "arrow-upward",
        iconBg: "#EDF2F8",
        iconFg: "#133A63",
      },
      {
        title: "Transferencia enviada",
        body: `Enviaste S/ ${entrada.amount.toFixed(2)} a ${beneficiario.name} (${beneficiario.bank}).`,
        icon: "arrow-upward",
        iconBg: "#EDF2F8",
        iconFg: "#133A63",
      }
    );
  });

  await recordAudit({
    userId: idUsuario,
    category: "TRANSFERENCIA",
    action: "transfer_completed",
    metadata: {
      payeeId: beneficiario.id,
      payeeName: beneficiario.name,
      payeeBank: beneficiario.bank,
      payeeAccount: beneficiario.accountNumber,
      amount: entrada.amount,
      concept: entrada.concept,
    },
    meta: metaSolicitud,
  });

  return {
    transactionId: transaccion.id,
    amount: entrada.amount,
    concept: entrada.concept,
    payee: { name: beneficiario.name, bank: beneficiario.bank, accountNumber: beneficiario.accountNumber },
    reference: generarReferencia(),
    createdAt: transaccion.createdAt,
  };
}
