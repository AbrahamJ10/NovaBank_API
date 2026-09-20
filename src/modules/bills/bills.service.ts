import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

type Db = typeof prisma | Prisma.TransactionClient;

// The catalog itself lives in the "proveedores_servicio" table (see
// prisma/seed.ts for the ~50 real Peruvian billers it's seeded with) —
// this module only shapes it for the API and derives simulated bill state,
// there's no real integration behind any one of them.
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

// Deterministic per (billerKey, supplyNumber[, cycle salt]) so looking the
// same account up twice returns the same answer, but different accounts —
// or a later cycle of the same one — get a different plausible bill.
function deriveBillState(billerKey: string, seed: string) {
  const h = hashString(`${billerKey}:${seed}`);
  const upToDate = h % 5 === 0; // ~20% of lookups have nothing currently due
  const amount = Math.round((25 + (h % 20000) / 100) * 100) / 100; // S/ 25.00–224.99
  const dueInDays = 5 + (h % 21); // 5–25 days out
  return { upToDate, amount, dueInDays };
}

// Prisma's Decimal serializes to a string by default — this keeps every
// bill response a real JS number, the same fix already applied to
// transactions/account amounts.
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

// A brand-new account has no real billing history, so it starts with a
// few illustrative affiliated services — same role as seedDefaultPayees
// for transfers.
export async function seedDefaultBills(db: Db, userId: string) {
  for (const s of STARTER_AFFILIATIONS) {
    const biller = await findBiller(s.billerKey);
    if (!biller) continue; // catalog not seeded yet in this environment — skip rather than fail registration
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
  if (existing) return toPublicBill(existing); // already affiliated — re-lookup is idempotent

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

// Rolls any affiliated service whose last payment (or "up to date" lookup)
// is more than a full cycle old back into a fresh pending bill — the lazy
// equivalent of a monthly billing job, run on read since there's no cron.
export async function listBills(userId: string) {
  const bills = await prisma.bill.findMany({ where: { userId }, orderBy: [{ paid: "asc" }, { dueDate: "asc" }] });
  const now = Date.now();

  const refreshed = await Promise.all(
    bills.map(async (b) => {
      if (b.suspended) return b; // paused — stays exactly as-is until resumed
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
