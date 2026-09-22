import PDFDocument from "pdfkit";
import { prisma } from "../../libreria/prisma";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";
import { enviarCorreo } from "../verificacion/correo";
import type { EntradaEnviarEstadoCuenta } from "./estadosCuenta.validadores";

const NOMBRES_MES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function dinero(n: number) {
  return `S/ ${n.toFixed(2)}`;
}

type TransaccionEstadoCuenta = {
  createdAt: Date;
  name: string;
  meta: string;
  kind: string;
  amount: number;
};

function construirPdfEstadoCuenta(entrada: {
  fullName: string;
  accountNumber: string;
  cci: string;
  month: number;
  year: number;
  transactions: TransaccionEstadoCuenta[];
  password: string | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      ...(entrada.password
        ? { userPassword: entrada.password, permissions: { printing: "highResolution" as const } }
        : {}),
    });
    const trozos: Buffer[] = [];
    doc.on("data", (trozo) => trozos.push(trozo));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#133A63").text("NovaBank");
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111").text("Estado de cuenta");
    doc.font("Helvetica").fontSize(10).fillColor("#555").text(`${NOMBRES_MES_ES[entrada.month - 1]} ${entrada.year}`);
    doc.moveDown(1);

    doc.font("Helvetica").fontSize(10).fillColor("#333");
    doc.text(`Titular: ${entrada.fullName}`);
    doc.text(`Cuenta: ${entrada.accountNumber}`);
    doc.text(`CCI: ${entrada.cci}`);
    doc.moveDown(1);

    let totalIngresos = 0;
    let totalSalidas = 0;
    for (const t of entrada.transactions) {
      if (t.kind === "CREDIT") totalIngresos += t.amount;
      else totalSalidas += t.amount;
    }

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text("Resumen del periodo");
    doc.font("Helvetica").fontSize(10).fillColor("#333");
    doc.text(`Ingresos: ${dinero(totalIngresos)}`);
    doc.text(`Salidas: ${dinero(totalSalidas)}`);
    doc.text(`Neto: ${dinero(totalIngresos - totalSalidas)}`);
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text("Movimientos");
    doc.moveDown(0.4);

    if (entrada.transactions.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#777").text("No hay movimientos registrados este mes.");
    } else {
      doc.font("Helvetica").fontSize(9);
      for (const t of entrada.transactions) {
        const signo = t.kind === "CREDIT" ? "+" : "-";
        const fechaStr = t.createdAt.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
        doc
          .fillColor(t.kind === "CREDIT" ? "#1F7A4D" : "#C2352B")
          .text(`${fechaStr}   ${signo}${dinero(t.amount)}   ${t.name} — ${t.meta}`);
      }
    }

    doc.end();
  });
}

export async function enviarEstadoCuenta(idUsuario: string, entrada: EntradaEnviarEstadoCuenta): Promise<void> {
  const [usuario, cuenta] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: idUsuario } }),
    prisma.account.findUnique({ where: { userId: idUsuario } }),
  ]);
  if (!cuenta) throw new ErrorHttp(404, "Cuenta no encontrada");

  const inicio = new Date(Date.UTC(entrada.year, entrada.month - 1, 1));
  const fin = new Date(Date.UTC(entrada.year, entrada.month, 1));

  const transacciones = await prisma.transaction.findMany({
    where: { accountId: cuenta.id, createdAt: { gte: inicio, lt: fin } },
    orderBy: { createdAt: "asc" },
  });

  // Protege el adjunto incluso si el correo mismo se reenvía o se filtra —
  // los últimos 4 dígitos del DNI son algo que solo el titular de la cuenta
  // (y NovaBank) ya conoce, no se envían junto con el PDF.
  const contrasena = usuario.dni && usuario.dni.length >= 4 ? usuario.dni.slice(-4) : null;

  const pdf = await construirPdfEstadoCuenta({
    fullName: usuario.fullName,
    accountNumber: cuenta.accountNumber,
    cci: cuenta.cci,
    month: entrada.month,
    year: entrada.year,
    transactions: transacciones.map((t) => ({
      createdAt: t.createdAt,
      name: t.name,
      meta: t.meta,
      kind: t.kind,
      amount: Number(t.amount),
    })),
    password: contrasena,
  });

  const etiquetaMes = `${NOMBRES_MES_ES[entrada.month - 1]} ${entrada.year}`;
  await enviarCorreo(
    usuario.email,
    `Tu estado de cuenta de ${etiquetaMes}`,
    `<div style="font-family:sans-serif;max-width:420px">
       <h2 style="color:#133A63">NovaBank</h2>
       <p>Adjuntamos tu estado de cuenta de <b>${etiquetaMes}</b> en PDF.</p>
       ${contrasena ? `<p style="color:#666;font-size:13px">El PDF está protegido con los últimos 4 dígitos de tu DNI.</p>` : ""}
     </div>`,
    [{ name: `NovaBank-${entrada.year}-${String(entrada.month).padStart(2, "0")}.pdf`, content: pdf.toString("base64") }]
  );
}
