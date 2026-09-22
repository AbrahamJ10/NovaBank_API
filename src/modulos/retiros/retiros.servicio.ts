import { Prisma } from "@prisma/client";
import { prisma } from "../../libreria/prisma";
import { HttpError } from "../../intermediarios/manejadorErrores";
import { recordTransaction } from "../transacciones/transacciones.servicio";
import { recordAudit } from "../auditoria/auditoria.servicio";
import type { RequestMeta } from "../../libreria/metaSolicitud";

const RETIRO_TTL_MS = 30 * 60 * 1000;

function generarCodigo() {
  let s = "";
  for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function aPublico(retiro: { id: string; code: string; amount: Prisma.Decimal; expiresAt: Date }) {
  return { id: retiro.id, code: retiro.code, amount: Number(retiro.amount), expiresAt: retiro.expiresAt };
}

export async function crearRetiro(idUsuario: string, monto: number, metaSolicitud?: RequestMeta) {
  const [cuenta, usuario] = await Promise.all([
    prisma.account.findUnique({ where: { userId: idUsuario } }),
    prisma.user.findUniqueOrThrow({ where: { id: idUsuario } }),
  ]);
  if (!cuenta) throw new HttpError(404, "Cuenta no encontrada");
  if (monto <= 0) throw new HttpError(400, "El monto debe ser mayor a cero");
  if (Number(cuenta.availableBalance) < monto) throw new HttpError(400, "Saldo insuficiente");
  if (monto > Number(cuenta.limitAtm)) {
    throw new HttpError(422, "Superaste tu límite de retiro en cajeros", {
      reasonCode: "R-LIMIT",
      reasonLabel: `Límite de retiro de S/ ${Number(cuenta.limitAtm).toFixed(2)} superado`,
    });
  }

  const retiro = await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId: idUsuario }, data: { availableBalance: { decrement: monto } } });

    let creado;
    for (let intento = 0; intento < 5; intento++) {
      try {
        creado = await tx.withdrawal.create({
          data: { userId: idUsuario, accountId: cuenta.id, code: generarCodigo(), amount: monto, expiresAt: new Date(Date.now() + RETIRO_TTL_MS) },
        });
        break;
      } catch (error) {
        const esChoqueDeUnicidad = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (esChoqueDeUnicidad && intento < 4) continue;
        throw error;
      }
    }
    if (!creado) throw new HttpError(500, "No se pudo generar la clave, intenta de nuevo");

    await recordTransaction(
      tx,
      idUsuario,
      cuenta.id,
      {
        kind: "DEBIT",
        category: "RETIROS",
        name: "Retiro sin tarjeta",
        meta: `Código ${creado.code}`,
        amount: monto,
        icon: "local-atm",
        iconBg: "#F4F6F9",
        iconFg: "#33414F",
      },
      usuario.alertWithdraw
        ? {
            title: "Retiro sin tarjeta generado",
            body: `Generaste una clave para retirar S/ ${monto.toFixed(2)} sin tarjeta.`,
            icon: "local-atm",
            iconBg: "#F4F6F9",
            iconFg: "#33414F",
          }
        : null
    );

    return creado;
  });

  await recordAudit({
    userId: idUsuario,
    category: "RETIRO",
    action: "withdrawal_created",
    metadata: { withdrawalId: retiro.id, amount: monto },
    meta: metaSolicitud,
  });

  return aPublico(retiro);
}

export async function cancelarRetiro(idUsuario: string, id: string, metaSolicitud?: RequestMeta) {
  const retiro = await prisma.withdrawal.findFirst({ where: { id, userId: idUsuario } });
  if (!retiro) throw new HttpError(404, "Retiro no encontrado");
  if (retiro.cancelledAt) throw new HttpError(409, "Este retiro ya fue cancelado");

  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: idUsuario } });
  const monto = Number(retiro.amount);

  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId: idUsuario }, data: { availableBalance: { increment: monto } } });
    await tx.withdrawal.update({ where: { id: retiro.id }, data: { cancelledAt: new Date() } });
    await recordTransaction(
      tx,
      idUsuario,
      retiro.accountId,
      {
        kind: "CREDIT",
        category: "RETIROS",
        name: "Reembolso — retiro cancelado",
        meta: `Código ${retiro.code}`,
        amount: monto,
        icon: "local-atm",
        iconBg: "#EAF9F1",
        iconFg: "#21A26B",
      },
      usuario.alertWithdraw
        ? {
            title: "Retiro cancelado",
            body: `Cancelaste tu clave de retiro y te devolvimos S/ ${monto.toFixed(2)}.`,
            icon: "local-atm",
            iconBg: "#EAF9F1",
            iconFg: "#21A26B",
          }
        : null
    );
  });

  await recordAudit({
    userId: idUsuario,
    category: "RETIRO",
    action: "withdrawal_cancelled",
    metadata: { withdrawalId: retiro.id, amount: monto },
    meta: metaSolicitud,
  });
}

export async function renovarRetiro(idUsuario: string, id: string, metaSolicitud?: RequestMeta) {
  const retiro = await prisma.withdrawal.findFirst({ where: { id, userId: idUsuario } });
  if (!retiro) throw new HttpError(404, "Retiro no encontrado");
  if (retiro.cancelledAt) throw new HttpError(409, "Este retiro ya fue cancelado");

  for (let intento = 0; intento < 5; intento++) {
    try {
      const actualizado = await prisma.withdrawal.update({
        where: { id: retiro.id },
        data: { code: generarCodigo(), expiresAt: new Date(Date.now() + RETIRO_TTL_MS) },
      });
      await recordAudit({
        userId: idUsuario,
        category: "RETIRO",
        action: "withdrawal_renewed",
        metadata: { withdrawalId: retiro.id, amount: Number(retiro.amount) },
        meta: metaSolicitud,
      });
      return aPublico(actualizado);
    } catch (error) {
      const esChoqueDeUnicidad = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (esChoqueDeUnicidad && intento < 4) continue;
      throw error;
    }
  }
  throw new HttpError(500, "No se pudo renovar la clave, intenta de nuevo");
}
