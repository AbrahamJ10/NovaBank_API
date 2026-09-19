import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";

// A tiny starter line so a fresh account isn't stuck at zero everywhere —
// this is an internal-ledger number only, not underwritten credit.
const STARTER_CREDIT_LINE = 1500;

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function randomDigits(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function generateAccountNumber() {
  return `191-${randomDigits(4)}-${randomDigits(4)}`;
}

// Visually shaped like a real CCI (bank-agency-account-check-digit), but
// not a computable real one — NovaBank isn't a licensed financial entity,
// so this only ever needs to look right inside its own ledger.
function generateCci() {
  return `002-191-${randomDigits(11)}-${randomDigits(2)}`;
}

function generateCardNumber() {
  return `4${randomDigits(15)}`; // Visa-shaped: starts with 4, 16 digits
}

function generateCardExpiry() {
  const now = new Date();
  const year = (now.getFullYear() + 4) % 100;
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${month}/${String(year).padStart(2, "0")}`;
}

function formatCutDate(cutDay: number): string {
  const now = new Date();
  let month = now.getMonth();
  if (now.getDate() > cutDay) {
    month = (month + 1) % 12;
  }
  return `${cutDay} ${MONTHS_ES[month]}`;
}

type Db = typeof prisma | Prisma.TransactionClient;

// Called from register() inside a $transaction with the user insert — if
// this fails, account creation is core to the app working at all, so the
// whole registration should roll back rather than leave a user with no
// account.
export async function createAccountForUser(db: Db, userId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const accountNumber = generateAccountNumber();
      return await db.account.create({
        data: {
          userId,
          accountNumber,
          cci: generateCci(),
          cardNumber: generateCardNumber(),
          cardExpiry: generateCardExpiry(),
          creditLine: STARTER_CREDIT_LINE,
        },
      });
    } catch (err) {
      const isUniqueClash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (isUniqueClash && attempt < 4) continue;
      throw err;
    }
  }
  throw new HttpError(500, "No se pudo crear la cuenta, intenta de nuevo");
}

export async function getAccountSummary(userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  const cardDebt = Number(account.cardDebt);
  const minPayment = cardDebt > 0 ? Math.round(Math.max(cardDebt * 0.05, 20) * 100) / 100 : 0;

  return {
    accountNumber: account.accountNumber,
    cci: account.cci,
    cardNumber: account.cardNumber,
    cardExpiry: account.cardExpiry,
    availableBalance: Number(account.availableBalance),
    heldBalance: Number(account.heldBalance),
    creditLine: Number(account.creditLine),
    cardDebt,
    minPayment,
    cutDate: formatCutDate(account.cutDay),
    cardBlocked: account.cardBlocked,
    memberSince: account.createdAt,
  };
}

export async function setCardBlocked(userId: string, blocked: boolean) {
  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) throw new HttpError(404, "Cuenta no encontrada");
  const updated = await prisma.account.update({ where: { userId }, data: { cardBlocked: blocked } });
  return updated.cardBlocked;
}
