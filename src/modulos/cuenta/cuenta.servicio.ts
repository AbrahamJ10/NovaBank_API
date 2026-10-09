import { Prisma } from "@prisma/client";
import { prisma } from "../../libreria/prisma";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";
import { verificarOtpPerfil } from "../verificacion/otp.servicio";
import { cifrar, descifrar } from "../../libreria/criptografia";
import { registrarAuditoria } from "../auditoria/auditoria.servicio";
import type { MetaSolicitud } from "../../libreria/metaSolicitud";

// Una pequeña línea de crédito inicial para que una cuenta nueva no quede
// atascada en cero por todos lados — es solo un número del libro contable
// interno, no crédito real evaluado.
const STARTER_CREDIT_LINE = 1500;

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function digitosAleatorios(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function generarNumeroCuenta() {
  return `191-${digitosAleatorios(4)}-${digitosAleatorios(4)}`;
}

// Con la forma visual de un CCI real (banco-agencia-cuenta-dígito
// verificador), pero no uno calculable de verdad — NovaBank no es una
// entidad financiera con licencia, así que solo necesita verse bien dentro
// de su propio libro contable.
function generarCci() {
  return `002-191-${digitosAleatorios(11)}-${digitosAleatorios(2)}`;
}

function generarNumeroTarjeta() {
  return `4${digitosAleatorios(15)}`; // Con forma Visa: empieza con 4, 16 dígitos
}

function generarCvv() {
  return digitosAleatorios(3);
}

function generarVencimientoTarjeta() {
  const ahora = new Date();
  const anio = (ahora.getFullYear() + 4) % 100;
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  return `${mes}/${String(anio).padStart(2, "0")}`;
}

function formatearFechaCorte(diaCorte: number): string {
  const ahora = new Date();
  let mes = ahora.getMonth();
  if (ahora.getDate() > diaCorte) {
    mes = (mes + 1) % 12;
  }
  return `${diaCorte} ${MONTHS_ES[mes]}`;
}

type Db = typeof prisma | Prisma.TransactionClient;

// Se llama desde register() dentro de una $transaction junto con la
// inserción del usuario — si esto falla, la creación de la cuenta es
// esencial para que la app funcione, así que todo el registro debe
// revertirse en vez de dejar un usuario sin cuenta.
export async function crearCuentaParaUsuario(db: Db, idUsuario: string) {
  for (let intento = 0; intento < 5; intento++) {
    try {
      const numeroCuenta = generarNumeroCuenta();
      return await db.account.create({
        data: {
          userId: idUsuario,
          accountNumber: numeroCuenta,
          cci: generarCci(),
          cardNumber: cifrar(generarNumeroTarjeta()),
          cardExpiry: generarVencimientoTarjeta(),
          cardCvv: cifrar(generarCvv()),
          creditLine: STARTER_CREDIT_LINE,
        },
      });
    } catch (error) {
      const esChoqueDeUnicidad = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (esChoqueDeUnicidad && intento < 4) continue;
      throw error;
    }
  }
  throw new ErrorHttp(500, "No se pudo crear la cuenta, intenta de nuevo");
}

export async function obtenerResumenCuenta(idUsuario: string) {
  const cuenta = await prisma.account.findUnique({ where: { userId: idUsuario } });
  if (!cuenta) throw new ErrorHttp(404, "Cuenta no encontrada");

  return {
    accountNumber: cuenta.accountNumber,
    cci: cuenta.cci,
    cardNumber: descifrar(cuenta.cardNumber),
    cardExpiry: cuenta.cardExpiry,
    availableBalance: Number(cuenta.availableBalance),
    heldBalance: Number(cuenta.heldBalance),
    creditLine: Number(cuenta.creditLine),
    cutDate: formatearFechaCorte(cuenta.cutDay),
    cardBlocked: cuenta.cardBlocked,
    memberSince: cuenta.createdAt,
  };
}

// Se confirma con el mismo código OTP por correo que se usa para cambios de
// perfil (ver profile.service.ts) — el CVV solo se puede leer después de
// probar control sobre el correo verificado de la cuenta, la misma barrera
// que cambiar la contraseña.
export async function revelarCvv(idUsuario: string, codigoOtp: string, metaSolicitud?: MetaSolicitud) {
  const [usuario, cuenta] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: idUsuario } }),
    prisma.account.findUnique({ where: { userId: idUsuario } }),
  ]);
  if (!cuenta) throw new ErrorHttp(404, "Cuenta no encontrada");

  await verificarOtpPerfil(usuario.email, codigoOtp);

  await registrarAuditoria({ userId: idUsuario, category: "TARJETA", action: "cvv_revealed", meta: metaSolicitud });

  return { cvv: descifrar(cuenta.cardCvv) };
}

export async function establecerBloqueoTarjeta(idUsuario: string, bloqueada: boolean, metaSolicitud?: MetaSolicitud) {
  const cuenta = await prisma.account.findUnique({ where: { userId: idUsuario } });
  if (!cuenta) throw new ErrorHttp(404, "Cuenta no encontrada");
  const actualizada = await prisma.account.update({ where: { userId: idUsuario }, data: { cardBlocked: bloqueada } });
  await registrarAuditoria({
    userId: idUsuario,
    category: "TARJETA",
    action: bloqueada ? "card_blocked" : "card_unblocked",
    meta: metaSolicitud,
  });
  return actualizada.cardBlocked;
}

