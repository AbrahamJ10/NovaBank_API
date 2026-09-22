import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

type Db = typeof prisma | Prisma.TransactionClient;

// El catálogo en sí vive en la tabla "proveedores_servicio" (ver
// prisma/seed.ts para las ~50 empresas peruanas reales con las que se
// siembra) — este módulo solo le da forma para la API y deriva el estado
// simulado de los recibos, no hay ninguna integración real detrás de
// ninguna de ellas.
export async function getCatalog() {
  const billers = await prisma.biller.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return billers.map((b) => ({ ...b, category: b.category.toLowerCase() }));
}

async function findBiller(key: string) {
  const biller = await prisma.biller.findUnique({ where: { key, active: true } });
  return biller;
}

const STARTER_AFFILIATIONS = [
  { billerKey: "luz-del-sur", supplyNumber: "0084 2210" },
  { billerKey: "sedapal", supplyNumber: "0021 8842" },
  { billerKey: "claro-movil", supplyNumber: "987 214 550" },
];

const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Determinista por (billerKey, supplyNumber[, salto de ciclo]) para que
// buscar la misma cuenta dos veces devuelva la misma respuesta, pero cuentas
// distintas — o un ciclo posterior de la misma — reciban un recibo distinto
// y verosímil.
function deriveBillState(billerKey: string, seed: string) {
  const h = hashString(`${billerKey}:${seed}`);
  const upToDate = h % 5 === 0; // ~20% de las consultas no tienen nada pendiente
  const amount = Math.round((25 + (h % 20000) / 100) * 100) / 100; // S/ 25.00–224.99
  const dueInDays = 5 + (h % 21); // 5–25 días de plazo
  return { upToDate, amount, dueInDays };
}

// El Decimal de Prisma se serializa como string por defecto — esto
// mantiene cada respuesta de recibo como un number real de JS, la misma
// corrección ya aplicada a los montos de transacciones/cuenta.
function toPublicBill<T extends { amount: Prisma.Decimal }>(bill: T): Omit<T, "amount"> & { amount: number } {
  return { ...bill, amount: Number(bill.amount) };
}

async function createAffiliation(db: Db, userId: string, biller: { key: string; name: string; icon: string; fieldLabel: string }, supplyNumber: string) {
  const { upToDate, amount, dueInDays } = deriveBillState(biller.key, supplyNumber);
  const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);
  return db.bill.create({
    data: {
      userId,
      billerKey: biller.key,
      supplyNumber,
      name: biller.name,
      meta: `${biller.fieldLabel} ${supplyNumber}`,
      icon: biller.icon,
      amount,
      dueDate,
      paid: upToDate,
      paidAt: upToDate ? new Date() : null,
    },
  });
}

// Una cuenta recién creada no tiene historial real de facturación, así que
// empieza con algunos servicios afiliados a modo de ejemplo — el mismo rol
// que seedDefaultPayees cumple para las transferencias.
export async function seedDefaultBills(db: Db, userId: string) {
  for (const s of STARTER_AFFILIATIONS) {
    const biller = await findBiller(s.billerKey);
    if (!biller) continue; // el catálogo aún no está sembrado en este entorno — se omite en vez de fallar el registro
    await createAffiliation(db, userId, biller, s.supplyNumber);
  }
}

export async function affiliateBill(userId: string, billerKey: string, supplyNumberRaw: string, meta?: RequestMeta) {
  const biller = await findBiller(billerKey);
  if (!biller) throw new HttpError(404, "Servicio no encontrado en el catálogo");

  const supplyNumber = supplyNumberRaw.trim();
  if (!supplyNumber) throw new HttpError(400, "Ingresa el dato solicitado");

  const existing = await prisma.bill.findUnique({
    where: { userId_billerKey_supplyNumber: { userId, billerKey, supplyNumber } },
  });
  if (existing) return toPublicBill(existing); // ya estaba afiliado — volver a consultarlo es idempotente

  const created = await createAffiliation(prisma, userId, biller, supplyNumber);
  await recordAudit({
    userId,
    category: "PAGO_SERVICIO",
    action: "bill_affiliated",
    metadata: { billId: created.id, billerKey, billerName: biller.name, supplyNumber },
    meta,
  });
  return toPublicBill(created);
}

// Regresa cualquier servicio afiliado cuyo último pago (o consulta "al día")
// tenga más de un ciclo completo de antigüedad a un recibo pendiente nuevo
// — el equivalente perezoso de un trabajo de facturación mensual, que se
// ejecuta al leer ya que no hay un cron.
export async function listBills(userId: string) {
  const bills = await prisma.bill.findMany({ where: { userId }, orderBy: [{ paid: "asc" }, { dueDate: "asc" }] });
  const now = Date.now();

  const refreshed = await Promise.all(
    bills.map(async (b) => {
      if (b.suspended) return b; // pausado — se queda exactamente igual hasta reanudarlo
      if (b.paid && b.paidAt && now - b.paidAt.getTime() >= CYCLE_MS) {
        const { amount, dueInDays } = deriveBillState(b.billerKey, `${b.supplyNumber}:${b.paidAt.getTime()}`);
        return prisma.bill.update({
          where: { id: b.id },
          data: { paid: false, paidAt: null, amount, dueDate: new Date(now + dueInDays * 24 * 60 * 60 * 1000) },
        });
      }
      return b;
    })
  );

  return refreshed.map(toPublicBill);
}

export async function payBill(userId: string, billId: string, meta?: RequestMeta) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, userId } });
  if (!bill) throw new HttpError(404, "Servicio no encontrado");
  if (bill.suspended) throw new HttpError(409, "Este servicio está suspendido, reactívalo para pagarlo");
  if (bill.paid) throw new HttpError(409, "Este servicio ya fue pagado");

  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  const amount = Number(bill.amount);
  if (Number(account.availableBalance) < amount) {
    await recordAudit({
      userId,
      category: "PAGO_SERVICIO",
      action: "bill_payment_failed_insufficient_balance",
      success: false,
      metadata: { billId: bill.id, billerKey: bill.billerKey, billName: bill.name, amount },
      meta,
    });
    throw new HttpError(400, "Saldo insuficiente");
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId }, data: { availableBalance: { decrement: amount } } });
    await tx.bill.update({ where: { id: bill.id }, data: { paid: true, paidAt: new Date() } });
    await recordTransaction(
      tx,
      userId,
      account.id,
      {
        kind: "DEBIT",
        category: "SERVICIOS",
        name: bill.name,
        meta: "Pago de servicio",
        amount,
        icon: bill.icon,
        iconBg: "#FFF9EC",
        iconFg: "#B07D07",
      },
      {
        title: "Servicio pagado",
        body: `Pagaste ${bill.name} por S/ ${amount.toFixed(2)}.`,
        icon: bill.icon,
        iconBg: "#FFF9EC",
        iconFg: "#B07D07",
      }
    );
  });

  await recordAudit({
    userId,
    category: "PAGO_SERVICIO",
    action: "bill_paid",
    metadata: { billId: bill.id, billerKey: bill.billerKey, billName: bill.name, amount },
    meta,
  });
}

export async function suspendBill(userId: string, billId: string, meta?: RequestMeta) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, userId } });
  if (!bill) throw new HttpError(404, "Servicio no encontrado");
  if (bill.suspended) throw new HttpError(409, "Este servicio ya está suspendido");
  const updated = await prisma.bill.update({ where: { id: bill.id }, data: { suspended: true } });
  await recordAudit({
    userId,
    category: "PAGO_SERVICIO",
    action: "bill_suspended",
    metadata: { billId: bill.id, billerKey: bill.billerKey, billName: bill.name },
    meta,
  });
  return toPublicBill(updated);
}

export async function resumeBill(userId: string, billId: string, meta?: RequestMeta) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, userId } });
  if (!bill) throw new HttpError(404, "Servicio no encontrado");
  if (!bill.suspended) throw new HttpError(409, "Este servicio no está suspendido");
  const updated = await prisma.bill.update({ where: { id: bill.id }, data: { suspended: false } });
  await recordAudit({
    userId,
    category: "PAGO_SERVICIO",
    action: "bill_resumed",
    metadata: { billId: bill.id, billerKey: bill.billerKey, billName: bill.name },
    meta,
  });
  return toPublicBill(updated);
}
