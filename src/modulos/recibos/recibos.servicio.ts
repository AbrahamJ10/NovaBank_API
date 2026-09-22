import { Prisma } from "@prisma/client";
import { prisma } from "../../libreria/prisma";
import { HttpError } from "../../intermediarios/manejadorErrores";
import { recordTransaction } from "../transacciones/transacciones.servicio";
import { recordAudit } from "../auditoria/auditoria.servicio";
import type { RequestMeta } from "../../libreria/metaSolicitud";

type Db = typeof prisma | Prisma.TransactionClient;

// El catálogo en sí vive en la tabla "proveedores_servicio" (ver
// prisma/seed.ts para las ~50 empresas peruanas reales con las que se
// siembra) — este módulo solo le da forma para la API y deriva el estado
// simulado de los recibos, no hay ninguna integración real detrás de
// ninguna de ellas.
export async function obtenerCatalogo() {
  const proveedores = await prisma.biller.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return proveedores.map((p) => ({ ...p, category: p.category.toLowerCase() }));
}

async function buscarProveedor(clave: string) {
  const proveedor = await prisma.biller.findUnique({ where: { key: clave, active: true } });
  return proveedor;
}

const AFILIACIONES_INICIALES = [
  { billerKey: "luz-del-sur", supplyNumber: "0084 2210" },
  { billerKey: "sedapal", supplyNumber: "0021 8842" },
  { billerKey: "claro-movil", supplyNumber: "987 214 550" },
];

const CICLO_MS = 30 * 24 * 60 * 60 * 1000;

function hashDeString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Determinista por (clave del proveedor, número de suministro[, salto de
// ciclo]) para que buscar la misma cuenta dos veces devuelva la misma
// respuesta, pero cuentas distintas — o un ciclo posterior de la misma —
// reciban un recibo distinto y verosímil.
function derivarEstadoRecibo(claveProveedor: string, semilla: string) {
  const h = hashDeString(`${claveProveedor}:${semilla}`);
  const alDia = h % 5 === 0; // ~20% de las consultas no tienen nada pendiente
  const monto = Math.round((25 + (h % 20000) / 100) * 100) / 100; // S/ 25.00–224.99
  const diasParaVencer = 5 + (h % 21); // 5–25 días de plazo
  return { alDia, monto, diasParaVencer };
}

// El Decimal de Prisma se serializa como string por defecto — esto
// mantiene cada respuesta de recibo como un number real de JS, la misma
// corrección ya aplicada a los montos de transacciones/cuenta.
function aReciboPublico<T extends { amount: Prisma.Decimal }>(recibo: T): Omit<T, "amount"> & { amount: number } {
  return { ...recibo, amount: Number(recibo.amount) };
}

async function crearAfiliacion(db: Db, idUsuario: string, proveedor: { key: string; name: string; icon: string; fieldLabel: string }, numeroSuministro: string) {
  const { alDia, monto, diasParaVencer } = derivarEstadoRecibo(proveedor.key, numeroSuministro);
  const fechaVencimiento = new Date(Date.now() + diasParaVencer * 24 * 60 * 60 * 1000);
  return db.bill.create({
    data: {
      userId: idUsuario,
      billerKey: proveedor.key,
      supplyNumber: numeroSuministro,
      name: proveedor.name,
      meta: `${proveedor.fieldLabel} ${numeroSuministro}`,
      icon: proveedor.icon,
      amount: monto,
      dueDate: fechaVencimiento,
      paid: alDia,
      paidAt: alDia ? new Date() : null,
    },
  });
}

// Una cuenta recién creada no tiene historial real de facturación, así que
// empieza con algunos servicios afiliados a modo de ejemplo — el mismo rol
// que seedDefaultPayees cumple para las transferencias.
export async function sembrarRecibosPorDefecto(db: Db, idUsuario: string) {
  for (const s of AFILIACIONES_INICIALES) {
    const proveedor = await buscarProveedor(s.billerKey);
    if (!proveedor) continue; // el catálogo aún no está sembrado en este entorno — se omite en vez de fallar el registro
    await crearAfiliacion(db, idUsuario, proveedor, s.supplyNumber);
  }
}

export async function afiliarServicio(idUsuario: string, claveProveedor: string, numeroSuministroCrudo: string, metaSolicitud?: RequestMeta) {
  const proveedor = await buscarProveedor(claveProveedor);
  if (!proveedor) throw new HttpError(404, "Servicio no encontrado en el catálogo");

  const numeroSuministro = numeroSuministroCrudo.trim();
  if (!numeroSuministro) throw new HttpError(400, "Ingresa el dato solicitado");

  const existente = await prisma.bill.findUnique({
    where: { userId_billerKey_supplyNumber: { userId: idUsuario, billerKey: claveProveedor, supplyNumber: numeroSuministro } },
  });
  if (existente) return aReciboPublico(existente); // ya estaba afiliado — volver a consultarlo es idempotente

  const creado = await crearAfiliacion(prisma, idUsuario, proveedor, numeroSuministro);
  await recordAudit({
    userId: idUsuario,
    category: "PAGO_SERVICIO",
    action: "bill_affiliated",
    metadata: { billId: creado.id, billerKey: claveProveedor, billerName: proveedor.name, supplyNumber: numeroSuministro },
    meta: metaSolicitud,
  });
  return aReciboPublico(creado);
}

// Regresa cualquier servicio afiliado cuyo último pago (o consulta "al día")
// tenga más de un ciclo completo de antigüedad a un recibo pendiente nuevo
// — el equivalente perezoso de un trabajo de facturación mensual, que se
// ejecuta al leer ya que no hay un cron.
export async function listarRecibos(idUsuario: string) {
  const recibos = await prisma.bill.findMany({ where: { userId: idUsuario }, orderBy: [{ paid: "asc" }, { dueDate: "asc" }] });
  const ahora = Date.now();

  const actualizados = await Promise.all(
    recibos.map(async (r) => {
      if (r.suspended) return r; // pausado — se queda exactamente igual hasta reanudarlo
      if (r.paid && r.paidAt && ahora - r.paidAt.getTime() >= CICLO_MS) {
        const { monto, diasParaVencer } = derivarEstadoRecibo(r.billerKey, `${r.supplyNumber}:${r.paidAt.getTime()}`);
        return prisma.bill.update({
          where: { id: r.id },
          data: { paid: false, paidAt: null, amount: monto, dueDate: new Date(ahora + diasParaVencer * 24 * 60 * 60 * 1000) },
        });
      }
      return r;
    })
  );

  return actualizados.map(aReciboPublico);
}

export async function pagarRecibo(idUsuario: string, idRecibo: string, metaSolicitud?: RequestMeta) {
  const recibo = await prisma.bill.findFirst({ where: { id: idRecibo, userId: idUsuario } });
  if (!recibo) throw new HttpError(404, "Servicio no encontrado");
  if (recibo.suspended) throw new HttpError(409, "Este servicio está suspendido, reactívalo para pagarlo");
  if (recibo.paid) throw new HttpError(409, "Este servicio ya fue pagado");

  const cuenta = await prisma.account.findUnique({ where: { userId: idUsuario } });
  if (!cuenta) throw new HttpError(404, "Cuenta no encontrada");

  const monto = Number(recibo.amount);
  if (Number(cuenta.availableBalance) < monto) {
    await recordAudit({
      userId: idUsuario,
      category: "PAGO_SERVICIO",
      action: "bill_payment_failed_insufficient_balance",
      success: false,
      metadata: { billId: recibo.id, billerKey: recibo.billerKey, billName: recibo.name, amount: monto },
      meta: metaSolicitud,
    });
    throw new HttpError(400, "Saldo insuficiente");
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { userId: idUsuario }, data: { availableBalance: { decrement: monto } } });
    await tx.bill.update({ where: { id: recibo.id }, data: { paid: true, paidAt: new Date() } });
    await recordTransaction(
      tx,
      idUsuario,
      cuenta.id,
      {
        kind: "DEBIT",
        category: "SERVICIOS",
        name: recibo.name,
        meta: "Pago de servicio",
        amount: monto,
        icon: recibo.icon,
        iconBg: "#FFF9EC",
        iconFg: "#B07D07",
      },
      {
        title: "Servicio pagado",
        body: `Pagaste ${recibo.name} por S/ ${monto.toFixed(2)}.`,
        icon: recibo.icon,
        iconBg: "#FFF9EC",
        iconFg: "#B07D07",
      }
    );
  });

  await recordAudit({
    userId: idUsuario,
    category: "PAGO_SERVICIO",
    action: "bill_paid",
    metadata: { billId: recibo.id, billerKey: recibo.billerKey, billName: recibo.name, amount: monto },
    meta: metaSolicitud,
  });
}

export async function suspenderServicio(idUsuario: string, idRecibo: string, metaSolicitud?: RequestMeta) {
  const recibo = await prisma.bill.findFirst({ where: { id: idRecibo, userId: idUsuario } });
  if (!recibo) throw new HttpError(404, "Servicio no encontrado");
  if (recibo.suspended) throw new HttpError(409, "Este servicio ya está suspendido");
  const actualizado = await prisma.bill.update({ where: { id: recibo.id }, data: { suspended: true } });
  await recordAudit({
    userId: idUsuario,
    category: "PAGO_SERVICIO",
    action: "bill_suspended",
    metadata: { billId: recibo.id, billerKey: recibo.billerKey, billName: recibo.name },
    meta: metaSolicitud,
  });
  return aReciboPublico(actualizado);
}

export async function reanudarServicio(idUsuario: string, idRecibo: string, metaSolicitud?: RequestMeta) {
  const recibo = await prisma.bill.findFirst({ where: { id: idRecibo, userId: idUsuario } });
  if (!recibo) throw new HttpError(404, "Servicio no encontrado");
  if (!recibo.suspended) throw new HttpError(409, "Este servicio no está suspendido");
  const actualizado = await prisma.bill.update({ where: { id: recibo.id }, data: { suspended: false } });
  await recordAudit({
    userId: idUsuario,
    category: "PAGO_SERVICIO",
    action: "bill_resumed",
    metadata: { billId: recibo.id, billerKey: recibo.billerKey, billName: recibo.name },
    meta: metaSolicitud,
  });
  return aReciboPublico(actualizado);
}
