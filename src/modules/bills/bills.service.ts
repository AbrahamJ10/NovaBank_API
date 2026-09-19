import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";

type Db = typeof prisma | Prisma.TransactionClient;

export type BillerCategory = "luz" | "agua" | "gas" | "movil" | "cable";

export type Biller = {
  key: string;
  name: string;
  category: BillerCategory;
  icon: string;
  iconBg: string;
  iconFg: string;
  fieldLabel: string;
  fieldPlaceholder: string;
};

// A fixed directory of real Peruvian billers — this is reference data (like
// any bank's own biller catalog), not simulated transaction history. There's
// no real integration behind each one, so looking one up (see
// deriveBillState below) produces a plausible, deterministic bill rather
// than a real fetch from Luz del Sur/Sedapal/etc.
export const BILLER_CATALOG: Biller[] = [
  { key: "luz-del-sur", name: "Luz del Sur", category: "luz", icon: "bolt", iconBg: "#FFF9EC", iconFg: "#B07D07", fieldLabel: "Número de suministro", fieldPlaceholder: "Ej. 0084 2210" },
  { key: "enel", name: "Enel Distribución", category: "luz", icon: "bolt", iconBg: "#FFF9EC", iconFg: "#B07D07", fieldLabel: "Número de suministro", fieldPlaceholder: "Ej. 1123 5567" },
  { key: "sedapal", name: "Sedapal", category: "agua", icon: "water-drop", iconBg: "#EAF3FF", iconFg: "#2C6FD1", fieldLabel: "Número de suministro", fieldPlaceholder: "Ej. 0021 8842" },
  { key: "calidda", name: "Cálidda", category: "gas", icon: "local-gas-station", iconBg: "#FDEDE7", iconFg: "#B45B2E", fieldLabel: "Número de suministro", fieldPlaceholder: "Ej. 0456 1290" },
  { key: "claro-movil", name: "Claro", category: "movil", icon: "wifi", iconBg: "#F4F6F9", iconFg: "#33414F", fieldLabel: "Número de línea", fieldPlaceholder: "Ej. 987 214 550" },
  { key: "movistar-movil", name: "Movistar", category: "movil", icon: "wifi", iconBg: "#F4F6F9", iconFg: "#33414F", fieldLabel: "Número de línea", fieldPlaceholder: "Ej. 945 112 334" },
  { key: "entel-movil", name: "Entel", category: "movil", icon: "wifi", iconBg: "#F4F6F9", iconFg: "#33414F", fieldLabel: "Número de línea", fieldPlaceholder: "Ej. 932 004 221" },
  { key: "bitel-movil", name: "Bitel", category: "movil", icon: "wifi", iconBg: "#F4F6F9", iconFg: "#33414F", fieldLabel: "Número de línea", fieldPlaceholder: "Ej. 916 220 771" },
  { key: "claro-tv", name: "Claro TV", category: "cable", icon: "live-tv", iconBg: "#FFF1E8", iconFg: "#D2691E", fieldLabel: "Código de cliente", fieldPlaceholder: "Ej. 55021847" },
  { key: "movistar-tv", name: "Movistar TV", category: "cable", icon: "live-tv", iconBg: "#FFF1E8", iconFg: "#D2691E", fieldLabel: "Código de cliente", fieldPlaceholder: "Ej. 33087421" },
];

export function getCatalog() {
  return BILLER_CATALOG;
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

async function createAffiliation(db: Db, userId: string, biller: Biller, supplyNumber: string) {
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
    const biller = BILLER_CATALOG.find((b) => b.key === s.billerKey)!;
    await createAffiliation(db, userId, biller, s.supplyNumber);
  }
}

export async function affiliateBill(userId: string, billerKey: string, supplyNumberRaw: string) {
  const biller = BILLER_CATALOG.find((b) => b.key === billerKey);
  if (!biller) throw new HttpError(404, "Servicio no encontrado en el catálogo");

  const supplyNumber = supplyNumberRaw.trim();
  if (!supplyNumber) throw new HttpError(400, "Ingresa el dato solicitado");

  const existing = await prisma.bill.findUnique({
    where: { userId_billerKey_supplyNumber: { userId, billerKey, supplyNumber } },
  });
  if (existing) return toPublicBill(existing); // already affiliated — re-lookup is idempotent

  return toPublicBill(await createAffiliation(prisma, userId, biller, supplyNumber));
}

// Rolls any affiliated service whose last payment (or "up to date" lookup)
// is more than a full cycle old back into a fresh pending bill — the lazy
// equivalent of a monthly billing job, run on read since there's no cron.
export async function listBills(userId: string) {
  const bills = await prisma.bill.findMany({ where: { userId }, orderBy: [{ paid: "asc" }, { dueDate: "asc" }] });
  const now = Date.now();

  const refreshed = await Promise.all(
    bills.map(async (b) => {
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

export async function payBill(userId: string, billId: string) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, userId } });
  if (!bill) throw new HttpError(404, "Servicio no encontrado");
  if (bill.paid) throw new HttpError(409, "Este servicio ya fue pagado");

  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  const amount = Number(bill.amount);
  if (Number(account.availableBalance) < amount) {
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
}
