import PDFDocument from "pdfkit";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { sendEmail } from "../verification/email";
import type { SendStatementInput } from "./statements.validators";

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function money(n: number) {
  return `S/ ${n.toFixed(2)}`;
}

type StatementTx = {
  createdAt: Date;
  name: string;
  meta: string;
  kind: string;
  amount: number;
};

function buildStatementPdf(input: {
  fullName: string;
  accountNumber: string;
  cci: string;
  month: number;
  year: number;
  transactions: StatementTx[];
  password: string | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      ...(input.password
        ? { userPassword: input.password, permissions: { printing: "highResolution" as const } }
        : {}),
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#133A63").text("NovaBank");
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111").text("Estado de cuenta");
    doc.font("Helvetica").fontSize(10).fillColor("#555").text(`${MONTH_NAMES_ES[input.month - 1]} ${input.year}`);
    doc.moveDown(1);

    doc.font("Helvetica").fontSize(10).fillColor("#333");
    doc.text(`Titular: ${input.fullName}`);
    doc.text(`Cuenta: ${input.accountNumber}`);
    doc.text(`CCI: ${input.cci}`);
    doc.moveDown(1);

    let totalIn = 0;
    let totalOut = 0;
    for (const t of input.transactions) {
      if (t.kind === "CREDIT") totalIn += t.amount;
      else totalOut += t.amount;
    }

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text("Resumen del periodo");
    doc.font("Helvetica").fontSize(10).fillColor("#333");
    doc.text(`Ingresos: ${money(totalIn)}`);
    doc.text(`Salidas: ${money(totalOut)}`);
    doc.text(`Neto: ${money(totalIn - totalOut)}`);
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text("Movimientos");
    doc.moveDown(0.4);

    if (input.transactions.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#777").text("No hay movimientos registrados este mes.");
    } else {
      doc.font("Helvetica").fontSize(9);
      for (const t of input.transactions) {
        const sign = t.kind === "CREDIT" ? "+" : "-";
        const dateStr = t.createdAt.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
        doc
          .fillColor(t.kind === "CREDIT" ? "#1F7A4D" : "#C2352B")
          .text(`${dateStr}   ${sign}${money(t.amount)}   ${t.name} — ${t.meta}`);
      }
    }

    doc.end();
  });
}

export async function sendStatement(userId: string, input: SendStatementInput): Promise<void> {
  const [user, account] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.account.findUnique({ where: { userId } }),
  ]);
  if (!account) throw new HttpError(404, "Cuenta no encontrada");

  const start = new Date(Date.UTC(input.year, input.month - 1, 1));
  const end = new Date(Date.UTC(input.year, input.month, 1));

  const transactions = await prisma.transaction.findMany({
    where: { accountId: account.id, createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
  });

  // Protects the attachment even if the email itself is forwarded/leaked —
  // the last 4 digits of the DNI are something only the account holder
  // (and NovaBank) already knows, not sent alongside the PDF.
  const password = user.dni && user.dni.length >= 4 ? user.dni.slice(-4) : null;

  const pdf = await buildStatementPdf({
    fullName: user.fullName,
    accountNumber: account.accountNumber,
    cci: account.cci,
    month: input.month,
    year: input.year,
    transactions: transactions.map((t) => ({
      createdAt: t.createdAt,
      name: t.name,
      meta: t.meta,
      kind: t.kind,
      amount: Number(t.amount),
    })),
    password,
  });

  const monthLabel = `${MONTH_NAMES_ES[input.month - 1]} ${input.year}`;
  await sendEmail(
    user.email,
    `Tu estado de cuenta de ${monthLabel}`,
    `<div style="font-family:sans-serif;max-width:420px">
       <h2 style="color:#133A63">NovaBank</h2>
       <p>Adjuntamos tu estado de cuenta de <b>${monthLabel}</b> en PDF.</p>
       ${password ? `<p style="color:#666;font-size:13px">El PDF está protegido con los últimos 4 dígitos de tu DNI.</p>` : ""}
     </div>`,
    [{ name: `NovaBank-${input.year}-${String(input.month).padStart(2, "0")}.pdf`, content: pdf.toString("base64") }]
  );
}
