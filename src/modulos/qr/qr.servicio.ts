import { prisma } from "../../libreria/prisma";
import { HttpError } from "../../intermediarios/manejadorErrores";
import { recordTransaction } from "../transacciones/transacciones.servicio";
import type { EntradaPagoQr } from "./qr.validadores";
import { recordAudit } from "../auditoria/auditoria.servicio";
import type { RequestMeta } from "../../libreria/metaSolicitud";

export async function pagarQr(idUsuario: string, entrada: EntradaPagoQr, metaSolicitud?: RequestMeta) {
  const [cuenta, usuario] = await Promise.all([
    prisma.account.findUnique({ where: { userId: idUsuario } }),
    prisma.user.findUniqueOrThrow({ where: { id: idUsuario } }),
  ]);
  if (!cuenta) throw new HttpError(404, "Cuenta no encontrada");
  if (Number(cuenta.availableBalance) < entrada.amount) {
    await recordAudit({
      userId: idUsuario,
      category: "QR",
      action: "qr_payment_failed_insufficient_balance",
      success: false,
      metadata: { merchant: entrada.merchant, amount: entrada.amount },
      meta: metaSolicitud,
    });
    throw new HttpError(400, "Saldo insuficiente");
  }

  const transaccion = await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId: idUsuario }, data: { availableBalance: { decrement: entrada.amount } } });
    return recordTransaction(
      tx,
      idUsuario,
      cuenta.id,
      {
        kind: "DEBIT",
        category: "QR",
        name: entrada.merchant,
        meta: "Pago QR",
        amount: entrada.amount,
        icon: "qr-code-2",
        iconBg: "#FFF1E8",
        iconFg: "#D2691E",
      },
      usuario.alertPurchase
        ? {
            title: "Pago con QR",
            body: `Pagaste S/ ${entrada.amount.toFixed(2)} a ${entrada.merchant}.`,
            icon: "qr-code-2",
            iconBg: "#FFF1E8",
            iconFg: "#D2691E",
          }
        : null
    );
  });

  await recordAudit({
    userId: idUsuario,
    category: "QR",
    action: "qr_payment_completed",
    metadata: { merchant: entrada.merchant, amount: entrada.amount },
    meta: metaSolicitud,
  });

  return { transactionId: transaccion.id, merchant: entrada.merchant, amount: entrada.amount, createdAt: transaccion.createdAt };
}
