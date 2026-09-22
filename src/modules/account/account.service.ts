import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { recordTransaction } from "../transactions/transactions.service";
import { verifyProfileOtp } from "../verification/otp.service";
import { encrypt, decrypt } from "../../lib/crypto";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

// Una pequeña línea de crédito inicial para que una cuenta nueva no quede
// atascada en cero por todos lados — es solo un número del libro contable
// interno, no crédito real evaluado.
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

// Con la forma visual de un CCI real (banco-agencia-cuenta-dígito
// verificador), pero no uno calculable de verdad — NovaBank no es una
// entidad financiera con licencia, así que solo necesita verse bien dentro
// de su propio libro contable.
function generateCci() {
  return `002-191-${randomDigits(11)}-${randomDigits(2)}`;
}

function generateCardNumber() {
  return `4${randomDigits(15)}`; // Con forma Visa: empieza con 4, 16 dígitos
}

function generateCvv() {
  return randomDigits(3);
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

// Se llama desde register() dentro de una $transaction junto con la
// inserción del usuario — si esto falla, la creación de la cuenta es
// esencial para que la app funcione, así que todo el registro debe
// revertirse en vez de dejar un usuario sin cuenta.
export async function createAccountForUser(db: Db, userId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const accountNumber = generateAccountNumber();
      return await db.account.create({
        data: {
          userId,
          accountNumber,
          cci: generateCci(),
          cardNumber: encrypt(generateCardNumber()),
          cardExpiry: generateCardExpiry(),
          cardCvv: encrypt(generateCvv()),
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
    cardNumber: decrypt(account.cardNumber),
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

// Se confirma con el mismo código OTP por correo que se usa para cambios de
// perfil (ver profile.service.ts) — el CVV solo se puede leer después de
// probar control sobre el correo verificado de la cuenta, la misma barrera
// que cambiar la contraseña.
export async function revealCvv(userId: string, otpCode: string, meta?: RequestMeta) {
  const [user, account] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.account.findUnique({ where: { userId } }),
  ]);
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  await verifyProfileOtp(user.email, otpCode);

  await recordAudit({ userId, category: "TARJETA", action: "cvv_revealed", meta });

  return { cvv: decrypt(account.cardCvv) };
}

export async function setCardBlocked(userId: string, blocked: boolean, meta?: RequestMeta) {
  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) throw new HttpError(404, "Cuenta no encontrada");
  const updated = await prisma.account.update({ where: { userId }, data: { cardBlocked: blocked } });
  await recordAudit({
    userId,
    category: "TARJETA",
    action: blocked ? "card_blocked" : "card_unblocked",
    meta,
  });
  return updated.cardBlocked;
}

export async function payCard(userId: string, amount: number, meta?: RequestMeta) {
  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  if (amount <= 0) throw new HttpError(400, "El monto debe ser mayor a cero");
  const cardDebt = Number(account.cardDebt);
  if (amount > cardDebt) throw new HttpError(400, "El monto supera tu deuda actual");
  if (Number(account.availableBalance) < amount) {
    await recordAudit({
      userId,
      category: "TARJETA",
      action: "card_payment_failed_insufficient_balance",
      success: false,
      metadata: { amount },
      meta,
    });
    throw new HttpError(400, "Saldo insuficiente");
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { userId },
      data: { availableBalance: { decrement: amount }, cardDebt: { decrement: amount } },
    });
    await recordTransaction(
      tx,
      userId,
      account.id,
      {
        kind: "DEBIT",
        category: "PAGO_TARJETA",
        name: "Pago de tarjeta",
        meta: "Pago de deuda de tarjeta de crédito",
        amount,
        icon: "credit-card",
        iconBg: "#EDF2F8",
        iconFg: "#133A63",
      },
      {
        title: "Pago de tarjeta realizado",
        body: `Pagaste S/ ${amount.toFixed(2)} de tu tarjeta de crédito.`,
        icon: "credit-card",
        iconBg: "#EDF2F8",
        iconFg: "#133A63",
      }
    );
  });

  await recordAudit({ userId, category: "TARJETA", action: "card_payment_completed", metadata: { amount }, meta });

  return getAccountSummary(userId);
}
