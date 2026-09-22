import { Prisma, TransactionCategory, TransactionKind } from "@prisma/client";
import { prisma } from "../../libreria/prisma";
import { createNotification, NotificationInput } from "../notificaciones/notificaciones.servicio";

type Db = typeof prisma | Prisma.TransactionClient;

export type NuevaEntradaTransaccion = {
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
// que las causó. La fila del historial nunca es opcional; `notificacion`
// sí lo es — quien llama y cuya categoría está controlada por una
// preferencia de notificación del usuario (ver User.alertPurchase/
// alertWithdraw) pasa null para omitirla ahí, mientras que la transacción
// en sí siempre se registra.
export async function recordTransaction(
  db: Db,
  idUsuario: string,
  idCuenta: string,
  entrada: NuevaEntradaTransaccion,
  notificacion: NotificationInput | null
) {
  const transaccion = await db.transaction.create({
    data: {
      accountId: idCuenta,
      kind: entrada.kind,
      category: entrada.category,
      name: entrada.name,
      meta: entrada.meta,
      amount: entrada.amount,
      icon: entrada.icon,
      iconBg: entrada.iconBg,
      iconFg: entrada.iconFg,
    },
  });
  if (notificacion) {
    await createNotification(db, idUsuario, notificacion);
  }
  return transaccion;
}

export async function listarTransacciones(idUsuario: string, limite = 50) {
  const cuenta = await prisma.account.findUnique({ where: { userId: idUsuario } });
  if (!cuenta) return [];

  const elementos = await prisma.transaction.findMany({
    where: { accountId: cuenta.id },
    orderBy: { createdAt: "desc" },
    take: limite,
  });

  return elementos.map((t) => ({
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
