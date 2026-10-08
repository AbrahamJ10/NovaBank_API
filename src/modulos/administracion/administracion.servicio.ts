import bcrypt from "bcryptjs";
import {
  Prisma, LoginEventResult, AuditCategory, TransactionKind, TransactionCategory,
  EstadoCasoSeguridad, PrioridadCaso, CategoriaCasoSeguridad,
} from "@prisma/client";
import { prisma } from "../../libreria/prisma";
import { ErrorHttp } from "../../intermediarios/manejadorErrores";
import { registrarAuditoria } from "../auditoria/auditoria.servicio";
import type { MetaSolicitud } from "../../libreria/metaSolicitud";

const RONDAS_SAL_CONTRASENA = 12;

function generarContrasenaTemporal(): string {
  const mayus = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minus = "abcdefghijkmnpqrstuvwxyz";
  const digitos = "23456789";
  const simbolos = "!@#%&*";
  const todas = mayus + minus + digitos + simbolos;
  let pass = mayus[Math.floor(Math.random() * mayus.length)] + minus[Math.floor(Math.random() * minus.length)] + digitos[Math.floor(Math.random() * digitos.length)];
  for (let i = pass.length; i < 14; i++) pass += todas[Math.floor(Math.random() * todas.length)];
  return pass.split("").sort(() => Math.random() - 0.5).join("");
}

function aUsuarioAdmin(u: {
  id: string; email: string; fullName: string; phone: string | null; dni: string | null;
  role: string; isActive: boolean; deletedAt: Date | null; failedLoginAttempts: number;
  lockedUntil: Date | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    dni: u.dni,
    role: u.role,
    isActive: u.isActive,
    deletedAt: u.deletedAt,
    failedLoginAttempts: u.failedLoginAttempts,
    lockedUntil: u.lockedUntil,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function asegurarNoAutoaccion(idAdmin: string, idObjetivo: string, accion: string) {
  if (idAdmin === idObjetivo) {
    throw new ErrorHttp(400, `No puedes ${accion} tu propia cuenta de administrador`);
  }
}

// Bitácora específica de admin — aparte de registrarAuditoria (que sigue
// escribiéndose también, para que la acción aparezca en el timeline
// general de Auditoría). Nunca debe tumbar la acción real si falla.
async function registrarAccionAdmin(entrada: {
  adminId: string;
  usuarioAfectadoId?: string | null;
  accion: string;
  valoresAntes?: Record<string, unknown> | null;
  valoresDespues?: Record<string, unknown> | null;
  descripcion?: string;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.accionAdmin.create({
      data: {
        adminId: entrada.adminId,
        usuarioAfectadoId: entrada.usuarioAfectadoId ?? null,
        accion: entrada.accion,
        valoresAntes: entrada.valoresAntes as Prisma.InputJsonValue | undefined,
        valoresDespues: entrada.valoresDespues as Prisma.InputJsonValue | undefined,
        descripcion: entrada.descripcion,
        ip: entrada.ip,
      },
    });
  } catch (error) {
    console.error("No se pudo registrar la acción de admin", entrada.accion, error);
  }
}

// ---------- Panel / estadísticas ----------
export async function obtenerEstadisticas() {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const [
    totalUsuarios,
    usuariosActivos,
    usuariosSuspendidos,
    usuariosEliminados,
    cuentasBloqueadas,
    nuevosHoy,
    loginsHoy,
    loginsFallidosHoy,
    sumaBalances,
    transaccionesHoy,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CLIENTE" } }),
    prisma.user.count({ where: { role: "CLIENTE", isActive: true, deletedAt: null } }),
    prisma.user.count({ where: { role: "CLIENTE", isActive: false, deletedAt: null } }),
    prisma.user.count({ where: { role: "CLIENTE", deletedAt: { not: null } } }),
    prisma.user.count({ where: { role: "CLIENTE", lockedUntil: { gt: new Date() } } }),
    prisma.user.count({ where: { role: "CLIENTE", createdAt: { gte: inicioHoy } } }),
    prisma.loginEvent.count({ where: { result: "SUCCESS", createdAt: { gte: inicioHoy } } }),
    prisma.loginEvent.count({ where: { result: { not: "SUCCESS" }, createdAt: { gte: inicioHoy } } }),
    prisma.account.aggregate({ _sum: { availableBalance: true } }),
    prisma.transaction.count({ where: { createdAt: { gte: inicioHoy } } }),
  ]);

  return {
    totalUsuarios,
    usuariosActivos,
    usuariosSuspendidos,
    usuariosEliminados,
    cuentasBloqueadas,
    nuevosHoy,
    loginsHoy,
    loginsFallidosHoy,
    balanceTotal: Number(sumaBalances._sum.availableBalance ?? 0),
    transaccionesHoy,
  };
}

// ---------- Usuarios ----------
export async function listarUsuarios(opts: {
  busqueda?: string; estado?: string; desde?: string; hasta?: string;
  saldoMin?: number; saldoMax?: number; pagina: number; limite: number;
}) {
  const where: Prisma.UserWhereInput = { role: "CLIENTE" };

  if (opts.busqueda) {
    where.OR = [
      { email: { contains: opts.busqueda, mode: "insensitive" } },
      { fullName: { contains: opts.busqueda, mode: "insensitive" } },
      { dni: { contains: opts.busqueda } },
      { phone: { contains: opts.busqueda } },
    ];
  }

  if (opts.estado === "activos") {
    where.isActive = true;
    where.deletedAt = null;
  } else if (opts.estado === "suspendidos") {
    where.isActive = false;
    where.deletedAt = null;
  } else if (opts.estado === "bloqueados") {
    where.lockedUntil = { gt: new Date() };
  } else if (opts.estado === "eliminados") {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }

  const fechas = rangoFechas(opts.desde, opts.hasta);
  if (fechas) where.createdAt = fechas;

  if (opts.saldoMin != null || opts.saldoMax != null) {
    where.account = {
      availableBalance: {
        ...(opts.saldoMin != null ? { gte: opts.saldoMin } : {}),
        ...(opts.saldoMax != null ? { lte: opts.saldoMax } : {}),
      },
    };
  }

  const [total, usuarios] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.pagina - 1) * opts.limite,
      take: opts.limite,
      include: { account: { select: { availableBalance: true, cardBlocked: true } } },
    }),
  ]);

  return {
    total,
    pagina: opts.pagina,
    limite: opts.limite,
    items: usuarios.map((u) => ({
      ...aUsuarioAdmin(u),
      availableBalance: u.account ? Number(u.account.availableBalance) : null,
      cardBlocked: u.account?.cardBlocked ?? null,
    })),
  };
}

export async function obtenerUsuarioDetalle(id: string) {
  const usuario = await prisma.user.findUnique({ where: { id }, include: { account: true } });
  if (!usuario) throw new ErrorHttp(404, "Usuario no encontrado");

  const [eventosLogin, auditoria, transacciones, notas, casos, historial] = await Promise.all([
    prisma.loginEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.auditLog.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    usuario.account
      ? prisma.transaction.findMany({ where: { accountId: usuario.account.id }, orderBy: { createdAt: "desc" }, take: 20 })
      : Promise.resolve([]),
    prisma.notaUsuario.findMany({ where: { usuarioId: id }, orderBy: { createdAt: "desc" }, include: { admin: { select: { fullName: true } } } }),
    prisma.casoSeguridad.findMany({ where: { usuarioId: id }, orderBy: { createdAt: "desc" }, include: { adminAsignado: { select: { fullName: true } } } }),
    prisma.historialCambio.findMany({ where: { usuarioId: id }, orderBy: { createdAt: "desc" }, take: 30, include: { admin: { select: { fullName: true } } } }),
  ]);

  return {
    usuario: aUsuarioAdmin(usuario),
    cuenta: usuario.account
      ? {
          accountNumber: usuario.account.accountNumber,
          cci: usuario.account.cci,
          availableBalance: Number(usuario.account.availableBalance),
          creditLine: Number(usuario.account.creditLine),
          cardDebt: Number(usuario.account.cardDebt),
          cardBlocked: usuario.account.cardBlocked,
        }
      : null,
    eventosLogin: eventosLogin.map((e) => ({ id: e.id, result: e.result, ip: e.ip, userAgent: e.userAgent, createdAt: e.createdAt })),
    auditoria: auditoria.map((a) => ({
      id: a.id, category: a.category, action: a.action, success: a.success, description: a.description,
      ip: a.ip, country: a.country, city: a.city, device: a.device, platform: a.platform, createdAt: a.createdAt,
    })),
    transacciones: transacciones.map((t) => ({
      id: t.id, name: t.name, amount: Number(t.amount), kind: t.kind, category: t.category, createdAt: t.createdAt,
    })),
    notas: notas.map((n) => ({ id: n.id, contenido: n.contenido, adminNombre: n.admin.fullName, createdAt: n.createdAt })),
    casos: casos.map((c) => ({
      id: c.id, categoria: c.categoria, estado: c.estado, prioridad: c.prioridad, descripcion: c.descripcion,
      resolucion: c.resolucion, adminAsignadoNombre: c.adminAsignado?.fullName ?? null,
      createdAt: c.createdAt, updatedAt: c.updatedAt, cerradoEn: c.cerradoEn,
    })),
    historialCambios: historial.map((h) => ({
      id: h.id, campo: h.campo, valorAnterior: h.valorAnterior, valorNuevo: h.valorNuevo,
      adminNombre: h.admin?.fullName ?? null, createdAt: h.createdAt,
    })),
  };
}

export async function actualizarUsuario(
  id: string,
  datos: { fullName?: string; email?: string; phone?: string | null; dni?: string | null },
  idAdmin: string,
  meta: MetaSolicitud
) {
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  const nuevosValores: Record<string, string | null> = {
    fullName: datos.fullName !== undefined ? datos.fullName.trim() : undefined as any,
    email: datos.email !== undefined ? datos.email.trim().toLowerCase() : undefined as any,
    phone: datos.phone !== undefined ? (!datos.phone ? null : datos.phone.trim()) : undefined as any,
    dni: datos.dni !== undefined ? (!datos.dni ? null : datos.dni.trim()) : undefined as any,
  };
  // Un registro de historial por cada campo que de verdad cambió — no por
  // cada campo que vino en la solicitud (el front puede mandar los cuatro
  // aunque solo uno haya cambiado de verdad).
  const CAMPO_LABEL: Record<string, string> = { fullName: "nombre completo", email: "correo", phone: "teléfono", dni: "DNI" };
  const camposCambiados = (Object.keys(nuevosValores) as (keyof typeof nuevosValores)[]).filter(
    (campo) => nuevosValores[campo] !== undefined && nuevosValores[campo] !== (usuario as any)[campo]
  );

  if (camposCambiados.length === 0) return aUsuarioAdmin(usuario);

  try {
    const actualizado = await prisma.user.update({
      where: { id },
      data: Object.fromEntries(camposCambiados.map((c) => [c, nuevosValores[c]])),
    });

    await prisma.historialCambio.createMany({
      data: camposCambiados.map((campo) => ({
        usuarioId: id,
        adminId: idAdmin,
        campo: CAMPO_LABEL[campo] ?? campo,
        valorAnterior: (usuario as any)[campo] ?? null,
        valorNuevo: nuevosValores[campo],
      })),
    });

    await registrarAuditoria({
      userId: id, category: "SEGURIDAD", action: "admin_edito_datos", success: true,
      metadata: { adminId: idAdmin, cambios: datos }, meta,
    });
    await registrarAccionAdmin({
      adminId: idAdmin, usuarioAfectadoId: id, accion: "editar_datos",
      valoresAntes: Object.fromEntries(camposCambiados.map((c) => [c, (usuario as any)[c] ?? null])),
      valoresDespues: Object.fromEntries(camposCambiados.map((c) => [c, nuevosValores[c]])),
      ip: meta.ip,
    });

    return aUsuarioAdmin(actualizado);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorHttp(409, "Ese correo, teléfono o DNI ya está en uso por otra cuenta");
    }
    throw error;
  }
}

export async function suspenderUsuario(id: string, idAdmin: string, meta: MetaSolicitud) {
  asegurarNoAutoaccion(idAdmin, id, "suspender");
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  await registrarAuditoria({ userId: id, category: "SEGURIDAD", action: "admin_suspendio_cuenta", metadata: { adminId: idAdmin }, meta });
  await registrarAccionAdmin({ adminId: idAdmin, usuarioAfectadoId: id, accion: "suspender_cuenta", valoresAntes: { isActive: true }, valoresDespues: { isActive: false }, ip: meta.ip });
  return { isActive: false };
}

export async function activarUsuario(id: string, idAdmin: string, meta: MetaSolicitud) {
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  await prisma.user.update({ where: { id }, data: { isActive: true } });
  await registrarAuditoria({ userId: id, category: "SEGURIDAD", action: "admin_activo_cuenta", metadata: { adminId: idAdmin }, meta });
  await registrarAccionAdmin({ adminId: idAdmin, usuarioAfectadoId: id, accion: "activar_cuenta", valoresAntes: { isActive: false }, valoresDespues: { isActive: true }, ip: meta.ip });
  return { isActive: true };
}

export async function desbloquearUsuario(id: string, idAdmin: string, meta: MetaSolicitud) {
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  await prisma.user.update({ where: { id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  await registrarAuditoria({ userId: id, category: "SEGURIDAD", action: "admin_desbloqueo_cuenta", metadata: { adminId: idAdmin }, meta });
  await registrarAccionAdmin({
    adminId: idAdmin, usuarioAfectadoId: id, accion: "desbloquear_cuenta",
    valoresAntes: { failedLoginAttempts: usuario.failedLoginAttempts, lockedUntil: usuario.lockedUntil },
    valoresDespues: { failedLoginAttempts: 0, lockedUntil: null }, ip: meta.ip,
  });
  return { lockedUntil: null };
}

export async function eliminarUsuario(id: string, idAdmin: string, meta: MetaSolicitud) {
  asegurarNoAutoaccion(idAdmin, id, "eliminar");
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  await prisma.user.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  await registrarAuditoria({ userId: id, category: "SEGURIDAD", action: "admin_elimino_cuenta", metadata: { adminId: idAdmin }, meta });
  await registrarAccionAdmin({ adminId: idAdmin, usuarioAfectadoId: id, accion: "eliminar_cuenta", valoresAntes: { deletedAt: null }, valoresDespues: { deletedAt: new Date().toISOString() }, ip: meta.ip });
  return { deletedAt: new Date() };
}

export async function restaurarUsuario(id: string, idAdmin: string, meta: MetaSolicitud) {
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  await prisma.user.update({ where: { id }, data: { deletedAt: null } });
  await registrarAuditoria({ userId: id, category: "SEGURIDAD", action: "admin_restauro_cuenta", metadata: { adminId: idAdmin }, meta });
  await registrarAccionAdmin({ adminId: idAdmin, usuarioAfectadoId: id, accion: "restaurar_cuenta", valoresAntes: { deletedAt: usuario.deletedAt }, valoresDespues: { deletedAt: null }, ip: meta.ip });
  return { deletedAt: null };
}

export async function restablecerContrasenaUsuario(id: string, idAdmin: string, meta: MetaSolicitud) {
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  const nuevaContrasena = generarContrasenaTemporal();
  const passwordHash = await bcrypt.hash(nuevaContrasena, RONDAS_SAL_CONTRASENA);
  await prisma.user.update({ where: { id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
  await registrarAuditoria({ userId: id, category: "SEGURIDAD", action: "admin_restablecio_contrasena", metadata: { adminId: idAdmin }, meta });
  await registrarAccionAdmin({ adminId: idAdmin, usuarioAfectadoId: id, accion: "restablecer_contrasena", descripcion: "Se generó una contraseña temporal", ip: meta.ip });
  return { temporaryPassword: nuevaContrasena };
}

function rangoFechas(desde?: string, hasta?: string): Prisma.DateTimeFilter | undefined {
  if (!desde && !hasta) return undefined;
  const filtro: Prisma.DateTimeFilter = {};
  if (desde) filtro.gte = new Date(`${desde}T00:00:00.000Z`);
  if (hasta) filtro.lte = new Date(`${hasta}T23:59:59.999Z`);
  return filtro;
}

// ---------- Seguridad / auditoría globales ----------
export async function listarEventosLogin(opts: {
  resultado?: string; correo?: string; ip?: string; desde?: string; hasta?: string; pagina: number; limite: number;
}) {
  const where: Prisma.LoginEventWhereInput = {};
  if (opts.resultado) where.result = opts.resultado as LoginEventResult;
  if (opts.correo) where.email = { contains: opts.correo, mode: "insensitive" };
  if (opts.ip) where.ip = { contains: opts.ip };
  const fechas = rangoFechas(opts.desde, opts.hasta);
  if (fechas) where.createdAt = fechas;

  const [total, items] = await Promise.all([
    prisma.loginEvent.count({ where }),
    prisma.loginEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.pagina - 1) * opts.limite,
      take: opts.limite,
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  return {
    total, pagina: opts.pagina, limite: opts.limite,
    items: items.map((e) => ({
      id: e.id, userId: e.userId, userName: e.user?.fullName ?? null, email: e.email, result: e.result,
      ip: e.ip, userAgent: e.userAgent, createdAt: e.createdAt,
    })),
  };
}

export async function listarAuditoriaGlobal(opts: {
  categoria?: string; busqueda?: string; soloFallidos?: boolean; ip?: string; desde?: string; hasta?: string;
  pagina: number; limite: number;
}) {
  const where: Prisma.AuditLogWhereInput = {};
  if (opts.categoria) where.category = opts.categoria as AuditCategory;
  if (opts.busqueda) {
    where.OR = [
      { action: { contains: opts.busqueda, mode: "insensitive" } },
      { user: { email: { contains: opts.busqueda, mode: "insensitive" } } },
      { user: { fullName: { contains: opts.busqueda, mode: "insensitive" } } },
    ];
  }
  if (opts.soloFallidos) where.success = false;
  if (opts.ip) where.ip = { contains: opts.ip };
  const fechas = rangoFechas(opts.desde, opts.hasta);
  if (fechas) where.createdAt = fechas;

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.pagina - 1) * opts.limite,
      take: opts.limite,
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
  ]);

  return {
    total, pagina: opts.pagina, limite: opts.limite,
    items: items.map((a) => ({
      id: a.id, userId: a.userId, userName: a.user?.fullName ?? null, userEmail: a.user?.email ?? null,
      category: a.category, action: a.action, success: a.success, description: a.description, metadata: a.metadata,
      ip: a.ip, country: a.country, city: a.city, device: a.device, platform: a.platform, createdAt: a.createdAt,
    })),
  };
}

export async function listarTransaccionesGlobal(opts: {
  tipo?: string; categoria?: string; busqueda?: string; desde?: string; hasta?: string; pagina: number; limite: number;
}) {
  const where: Prisma.TransactionWhereInput = {};
  if (opts.tipo) where.kind = opts.tipo as TransactionKind;
  if (opts.categoria) where.category = opts.categoria as TransactionCategory;
  if (opts.busqueda) {
    where.account = {
      user: {
        OR: [
          { email: { contains: opts.busqueda, mode: "insensitive" } },
          { fullName: { contains: opts.busqueda, mode: "insensitive" } },
        ],
      },
    };
  }
  const fechas = rangoFechas(opts.desde, opts.hasta);
  if (fechas) where.createdAt = fechas;

  const [total, items] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.pagina - 1) * opts.limite,
      take: opts.limite,
      include: { account: { select: { user: { select: { id: true, fullName: true, email: true } } } } },
    }),
  ]);

  return {
    total, pagina: opts.pagina, limite: opts.limite,
    items: items.map((t) => ({
      id: t.id, name: t.name, meta: t.meta, amount: Number(t.amount), kind: t.kind, category: t.category,
      createdAt: t.createdAt,
      userId: t.account.user?.id ?? null, userName: t.account.user?.fullName ?? null, userEmail: t.account.user?.email ?? null,
    })),
  };
}

// ---------- Notas internas ----------
export async function crearNotaUsuario(usuarioId: string, idAdmin: string, contenido: string) {
  const usuario = await prisma.user.findUnique({ where: { id: usuarioId } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  const nota = await prisma.notaUsuario.create({
    data: { usuarioId, adminId: idAdmin, contenido: contenido.trim() },
    include: { admin: { select: { fullName: true } } },
  });
  await registrarAccionAdmin({ adminId: idAdmin, usuarioAfectadoId: usuarioId, accion: "agregar_nota", descripcion: contenido.trim() });
  return { id: nota.id, contenido: nota.contenido, adminNombre: nota.admin.fullName, createdAt: nota.createdAt };
}

export async function eliminarNotaUsuario(notaId: string, idAdmin: string) {
  const nota = await prisma.notaUsuario.findUnique({ where: { id: notaId } });
  if (!nota) throw new ErrorHttp(404, "Nota no encontrada");

  await prisma.notaUsuario.delete({ where: { id: notaId } });
  await registrarAccionAdmin({ adminId: idAdmin, usuarioAfectadoId: nota.usuarioId, accion: "eliminar_nota", descripcion: nota.contenido });
}

// ---------- Casos de seguridad ----------
export async function listarCasosSeguridad(opts: { estado?: string; prioridad?: string; busqueda?: string; pagina: number; limite: number }) {
  const where: Prisma.CasoSeguridadWhereInput = {};
  if (opts.estado) where.estado = opts.estado as EstadoCasoSeguridad;
  if (opts.prioridad) where.prioridad = opts.prioridad as PrioridadCaso;
  if (opts.busqueda) {
    where.usuario = {
      OR: [
        { email: { contains: opts.busqueda, mode: "insensitive" } },
        { fullName: { contains: opts.busqueda, mode: "insensitive" } },
      ],
    };
  }

  const [total, items] = await Promise.all([
    prisma.casoSeguridad.count({ where }),
    prisma.casoSeguridad.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.pagina - 1) * opts.limite,
      take: opts.limite,
      include: { usuario: { select: { id: true, fullName: true, email: true } }, adminAsignado: { select: { fullName: true } } },
    }),
  ]);

  return {
    total, pagina: opts.pagina, limite: opts.limite,
    items: items.map((c) => ({
      id: c.id, categoria: c.categoria, estado: c.estado, prioridad: c.prioridad, descripcion: c.descripcion,
      usuarioId: c.usuario.id, usuarioNombre: c.usuario.fullName, usuarioEmail: c.usuario.email,
      adminAsignadoNombre: c.adminAsignado?.fullName ?? null, createdAt: c.createdAt, cerradoEn: c.cerradoEn,
    })),
  };
}

export async function crearCasoSeguridad(
  usuarioId: string,
  datos: { categoria: string; prioridad?: string; descripcion: string },
  idAdmin: string
) {
  const usuario = await prisma.user.findUnique({ where: { id: usuarioId } });
  if (!usuario || usuario.role !== "CLIENTE") throw new ErrorHttp(404, "Usuario no encontrado");

  const caso = await prisma.casoSeguridad.create({
    data: {
      usuarioId,
      categoria: datos.categoria as CategoriaCasoSeguridad,
      prioridad: (datos.prioridad as PrioridadCaso) ?? undefined,
      descripcion: datos.descripcion.trim(),
      adminAsignadoId: idAdmin,
    },
  });
  await registrarAccionAdmin({
    adminId: idAdmin, usuarioAfectadoId: usuarioId, accion: "abrir_caso_seguridad",
    descripcion: datos.descripcion.trim(), valoresDespues: { categoria: datos.categoria, prioridad: caso.prioridad },
  });
  return caso;
}

export async function actualizarCasoSeguridad(
  casoId: string,
  datos: { estado?: string; prioridad?: string; adminAsignadoId?: string | null; resolucion?: string },
  idAdmin: string
) {
  const caso = await prisma.casoSeguridad.findUnique({ where: { id: casoId } });
  if (!caso) throw new ErrorHttp(404, "Caso no encontrado");

  const actualizado = await prisma.casoSeguridad.update({
    where: { id: casoId },
    data: {
      estado: datos.estado as EstadoCasoSeguridad | undefined,
      prioridad: datos.prioridad as PrioridadCaso | undefined,
      adminAsignadoId: datos.adminAsignadoId,
      resolucion: datos.resolucion,
      cerradoEn: datos.estado === "CERRADO" ? new Date() : datos.estado ? null : undefined,
    },
  });
  await registrarAccionAdmin({
    adminId: idAdmin, usuarioAfectadoId: caso.usuarioId, accion: "actualizar_caso_seguridad",
    valoresAntes: { estado: caso.estado, prioridad: caso.prioridad },
    valoresDespues: { estado: actualizado.estado, prioridad: actualizado.prioridad },
  });
  return actualizado;
}

// ---------- Bitácora de acciones de administradores ----------
export async function listarAccionesAdmin(opts: { adminId?: string; pagina: number; limite: number }) {
  const where: Prisma.AccionAdminWhereInput = {};
  if (opts.adminId) where.adminId = opts.adminId;

  const [total, items] = await Promise.all([
    prisma.accionAdmin.count({ where }),
    prisma.accionAdmin.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.pagina - 1) * opts.limite,
      take: opts.limite,
      include: {
        admin: { select: { fullName: true, email: true } },
        usuarioAfectado: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  return {
    total, pagina: opts.pagina, limite: opts.limite,
    items: items.map((a) => ({
      id: a.id, accion: a.accion, descripcion: a.descripcion,
      valoresAntes: a.valoresAntes, valoresDespues: a.valoresDespues,
      adminNombre: a.admin.fullName, adminEmail: a.admin.email,
      usuarioAfectadoNombre: a.usuarioAfectado?.fullName ?? null, usuarioAfectadoEmail: a.usuarioAfectado?.email ?? null,
      ip: a.ip, createdAt: a.createdAt,
    })),
  };
}
