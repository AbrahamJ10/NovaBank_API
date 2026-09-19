import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";

const WITHDRAW_TTL_MS = 30 * 60 * 1000;

function generateCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function toPublic(w: { id: string; code: string; amount: Prisma.Decimal; expiresAt: Date }) {
  return { id: w.id, code: w.code, amount: Number(w.amount), expiresAt: w.expiresAt };
}

export async function createWithdrawal(userId: string, amount: number) {
  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) throw new HttpError(404, "Cuenta no encontrada");
  if (amount <= 0) throw new HttpError(400, "El monto debe ser mayor a cero");
  if (Number(account.availableBalance) < amount) throw new HttpError(400, "Saldo insuficiente");
  if (amount > Number(account.limitAtm)) {
    throw new HttpError(422, "Superaste tu límite de retiro en cajeros", {
      reasonCode: "R-LIMIT",
      reasonLabel: `Límite de retiro de S/ ${Number(account.limitAtm).toFixed(2)} superado`,
    });
  }

  const withdrawal = await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId }, data: { availableBalance: { decrement: amount } } });

    let created;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        created = await tx.withdrawal.create({
          data: { userId, accountId: account.id, code: generateCode(), amount, expiresAt: new Date(Date.now() + WITHDRAW_TTL_MS) },
        });
        break;
      } catch (err) {
        const isUniqueClash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (isUniqueClash && attempt < 4) continue;
        throw err;
      }
    }
    if (!created) throw new HttpError(500, "No se pudo generar la clave, intenta de nuevo");

    await recordTransaction(
      tx,
      userId,
      account.id,
      {
        kind: "DEBIT",
        category: "RETIROS",
        name: "Retiro sin tarjeta",
        meta: `Código ${created.code}`,
        amount,
        icon: "local-atm",
        iconBg: "#F4F6F9",
        iconFg: "#33414F",
      },
      {
        title: "Retiro sin tarjeta generado",
        body: `Generaste una clave para retirar S/ ${amount.toFixed(2)} sin tarjeta.`,
        icon: "local-atm",
        iconBg: "#F4F6F9",
        iconFg: "#33414F",
      }
    );

    return created;
  });

  return toPublic(withdrawal);
}

export async function cancelWithdrawal(userId: string, id: string) {
  const withdrawal = await prisma.withdrawal.findFirst({ where: { id, userId } });
  if (!withdrawal) throw new HttpError(404, "Retiro no encontrado");
  if (withdrawal.cancelledAt) throw new HttpError(409, "Este retiro ya fue cancelado");

  const amount = Number(withdrawal.amount);

  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId }, data: { availableBalance: { increment: amount } } });
    await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { cancelledAt: new Date() } });
    await recordTransaction(
      tx,
      userId,
      withdrawal.accountId,
      {
        kind: "CREDIT",
        category: "RETIROS",
        name: "Reembolso — retiro cancelado",
        meta: `Código ${withdrawal.code}`,
        amount,
        icon: "local-atm",
        iconBg: "#EAF9F1",
        iconFg: "#21A26B",
      },
      {
        title: "Retiro cancelado",
        body: `Cancelaste tu clave de retiro y te devolvimos S/ ${amount.toFixed(2)}.`,
        icon: "local-atm",
        iconBg: "#EAF9F1",
        iconFg: "#21A26B",
      }
    );
  });
}

export async function renewWithdrawal(userId: string, id: string) {
  const withdrawal = await prisma.withdrawal.findFirst({ where: { id, userId } });
  if (!withdrawal) throw new HttpError(404, "Retiro no encontrado");
  if (withdrawal.cancelledAt) throw new HttpError(409, "Este retiro ya fue cancelado");

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { code: generateCode(), expiresAt: new Date(Date.now() + WITHDRAW_TTL_MS) },
      });
      return toPublic(updated);
    } catch (err) {
      const isUniqueClash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (isUniqueClash && attempt < 4) continue;
      throw err;
    }
  }
  throw new HttpError(500, "No se pudo renovar la clave, intenta de nuevo");
}
