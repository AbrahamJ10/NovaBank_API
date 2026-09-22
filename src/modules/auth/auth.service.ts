import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import {
  generateRefreshToken,
  hashToken,
  refreshTtlToDate,
  signAccessToken,
} from "../../lib/jwt";
import type {
  EntradaLoginFacial,
  EntradaLogin,
  EntradaConfirmarRestablecerContrasena,
  EntradaSolicitarRestablecerContrasena,
  EntradaRegistro,
} from "./auth.validators";
import { requestPasswordResetOtp, verifyPasswordResetOtp, verifyRegisterOtp } from "../verification/otp.service";
import { crearCuentaParaUsuario } from "../account/account.service";
import { sembrarBeneficiariosPorDefecto } from "../payees/payees.service";
import { sembrarRecibosPorDefecto } from "../bills/bills.service";
import { compareFaces } from "../verification/face.service";
import { uploadFaceReference } from "../../lib/cloudinary";
import { createNotification } from "../notifications/notifications.service";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

const MAX_INTENTOS_FALLIDOS = 5;
const DURACION_BLOQUEO_MS = 15 * 60 * 1000;
const RONDAS_SAL_CONTRASENA = 12;

function aUsuarioPublico(usuario: { id: string; email: string; fullName: string; phone: string | null; dni: string | null }) {
  return { id: usuario.id, email: usuario.email, fullName: usuario.fullName, phone: usuario.phone, dni: usuario.dni };
}

async function emitirParDeTokens(idUsuario: string, correo: string, metaSolicitud: RequestMeta) {
  const accessToken = signAccessToken({ sub: idUsuario, email: correo });
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: idUsuario,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTtlToDate(),
      ip: metaSolicitud.ip,
      userAgent: metaSolicitud.userAgent,
    },
  });

  return { accessToken, refreshToken };
}

export async function registrar(entrada: EntradaRegistro, metaSolicitud: RequestMeta) {
  const existente = await prisma.user.findUnique({ where: { email: entrada.email } });
  if (existente) {
    throw new HttpError(409, "Ya existe una cuenta con ese correo");
  }

  await verifyRegisterOtp(entrada.email, entrada.otpCode);

  const hashContrasena = await bcrypt.hash(entrada.password, RONDAS_SAL_CONTRASENA);

  // La cuenta (saldo/tarjeta/historial de transacciones) es esencial para
  // que la app funcione, así que se crea de forma atómica junto con el
  // usuario — si cualquiera de las dos falla, ambas se revierten en vez de
  // dejar un usuario sin cuenta.
  const usuario = await prisma.$transaction(async (tx) => {
    const creado = await tx.user.create({
      data: {
        email: entrada.email,
        passwordHash: hashContrasena,
        fullName: entrada.fullName,
        phone: entrada.phone,
        dni: entrada.dni,
      },
    });
    await crearCuentaParaUsuario(tx, creado.id);
    await sembrarBeneficiariosPorDefecto(tx, creado.id);
    await sembrarRecibosPorDefecto(tx, creado.id);
    return creado;
  });

  // Mejor esfuerzo: no se necesita una referencia facial para tener una
  // cuenta, solo para usar el login con Face ID después. No se debe fallar
  // el registro por esto.
  if (entrada.dniPhoto && entrada.selfie) {
    try {
      const [urlFotoDni, urlFotoSelfie] = await Promise.all([
        uploadFaceReference(entrada.dniPhoto, `${usuario.id}-dni`),
        uploadFaceReference(entrada.selfie, `${usuario.id}-selfie`),
      ]);
      await prisma.faceReference.create({ data: { userId: usuario.id, dniPhotoUrl: urlFotoDni, selfiePhotoUrl: urlFotoSelfie } });
    } catch (error) {
      console.error("No se pudo guardar la referencia facial de", usuario.id, error);
    }
  }

  const tokens = await emitirParDeTokens(usuario.id, usuario.email, metaSolicitud);
  await recordAudit({ userId: usuario.id, category: "SESION", action: "register", meta: metaSolicitud });
  return { user: aUsuarioPublico(usuario), ...tokens };
}

type RegistroUsuario = Awaited<ReturnType<typeof prisma.user.findUnique>>;

// Compartido entre el login con contraseña y el login con Face ID — el
// bloqueo debe aplicarse sin importar qué factor esté intentando un
// atacante, o Face ID se vuelve una puerta trasera alrededor de la
// protección contra fuerza bruta.
async function verificarLoginPermitido(usuario: NonNullable<RegistroUsuario>, metaSolicitud: RequestMeta) {
  if (usuario.lockedUntil && usuario.lockedUntil > new Date()) {
    await prisma.loginEvent.create({
      data: { userId: usuario.id, email: usuario.email, result: "ACCOUNT_LOCKED", ip: metaSolicitud.ip, userAgent: metaSolicitud.userAgent },
    });
    await recordAudit({ userId: usuario.id, category: "SESION", action: "login_blocked_locked", success: false, meta: metaSolicitud });
    throw new HttpError(423, "Cuenta bloqueada temporalmente por demasiados intentos fallidos", {
      lockedUntil: usuario.lockedUntil.toISOString(),
    });
  }

  if (!usuario.isActive) {
    await prisma.loginEvent.create({
      data: { userId: usuario.id, email: usuario.email, result: "ACCOUNT_INACTIVE", ip: metaSolicitud.ip, userAgent: metaSolicitud.userAgent },
    });
    await recordAudit({ userId: usuario.id, category: "SESION", action: "login_blocked_inactive", success: false, meta: metaSolicitud });
    throw new HttpError(403, "Cuenta inactiva");
  }
}

async function registrarIntentoFallido(usuario: NonNullable<RegistroUsuario>, metaSolicitud: RequestMeta, errorInvalido: () => HttpError) {
  const intentosFallidos = usuario.failedLoginAttempts + 1;
  const debeBloquear = intentosFallidos >= MAX_INTENTOS_FALLIDOS;
  const bloqueadoHasta = debeBloquear ? new Date(Date.now() + DURACION_BLOQUEO_MS) : null;

  await prisma.user.update({
    where: { id: usuario.id },
    data: { failedLoginAttempts: debeBloquear ? 0 : intentosFallidos, lockedUntil: bloqueadoHasta },
  });
  await prisma.loginEvent.create({
    data: {
      userId: usuario.id,
      email: usuario.email,
      result: debeBloquear ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
      ip: metaSolicitud.ip,
      userAgent: metaSolicitud.userAgent,
    },
  });
  await recordAudit({
    userId: usuario.id,
    category: "SESION",
    action: debeBloquear ? "login_failed_now_locked" : "login_failed",
    success: false,
    metadata: { failedLoginAttempts: intentosFallidos },
    meta: metaSolicitud,
  });

  if (debeBloquear) {
    throw new HttpError(423, "Cuenta bloqueada temporalmente por demasiados intentos fallidos", {
      lockedUntil: bloqueadoHasta!.toISOString(),
    });
  }
  throw errorInvalido();
}

async function registrarLoginExitoso(usuario: NonNullable<RegistroUsuario>, metaSolicitud: RequestMeta, metodo: "password" | "face_id") {
  await prisma.user.update({
    where: { id: usuario.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  await prisma.loginEvent.create({
    data: { userId: usuario.id, email: usuario.email, result: "SUCCESS", ip: metaSolicitud.ip, userAgent: metaSolicitud.userAgent },
  });
  await recordAudit({ userId: usuario.id, category: "SESION", action: "login_success", metadata: { method: metodo }, meta: metaSolicitud });
  if (usuario.alertLogin) {
    await createNotification(prisma, usuario.id, {
      title: "Nuevo inicio de sesión",
      body: metaSolicitud.ip ? `Iniciaste sesión desde ${metaSolicitud.ip}.` : "Iniciaste sesión con tu contraseña.",
      icon: "login",
      iconBg: "#EDF2F8",
      iconFg: "#133A63",
    });
  }
}

export async function iniciarSesion(entrada: EntradaLogin, metaSolicitud: RequestMeta) {
  const usuario = await prisma.user.findUnique({ where: { email: entrada.email } });

  // El mismo error genérico ya sea que el correo no exista o la contraseña
  // esté mal — evita revelar qué correos están registrados (enumeración de
  // usuarios).
  const errorCredencialesInvalidas = () => new HttpError(401, "Correo o contraseña incorrectos");

  if (!usuario) {
    await prisma.loginEvent.create({
      data: { email: entrada.email, result: "INVALID_CREDENTIALS", ip: metaSolicitud.ip, userAgent: metaSolicitud.userAgent },
    });
    await recordAudit({
      category: "SESION",
      action: "login_failed_unknown_email",
      success: false,
      description: entrada.email,
      meta: metaSolicitud,
    });
    throw errorCredencialesInvalidas();
  }

  await verificarLoginPermitido(usuario, metaSolicitud);

  const coincideContrasena = await bcrypt.compare(entrada.password, usuario.passwordHash);
  if (!coincideContrasena) {
    await registrarIntentoFallido(usuario, metaSolicitud, errorCredencialesInvalidas);
  }

  await registrarLoginExitoso(usuario, metaSolicitud, "password");

  const tokens = await emitirParDeTokens(usuario.id, usuario.email, metaSolicitud);
  return { user: aUsuarioPublico(usuario), ...tokens };
}

export async function iniciarSesionConRostro(entrada: EntradaLoginFacial, metaSolicitud: RequestMeta) {
  const usuario = await prisma.user.findUnique({ where: { email: entrada.email }, include: { faceReference: true } });

  const errorInvalido = () => new HttpError(401, "No pudimos verificar tu identidad");

  if (!usuario) {
    await prisma.loginEvent.create({
      data: { email: entrada.email, result: "INVALID_CREDENTIALS", ip: metaSolicitud.ip, userAgent: metaSolicitud.userAgent },
    });
    await recordAudit({
      category: "SESION",
      action: "login_failed_unknown_email",
      success: false,
      description: entrada.email,
      metadata: { method: "face_id" },
      meta: metaSolicitud,
    });
    throw errorInvalido();
  }

  await verificarLoginPermitido(usuario, metaSolicitud);

  if (!usuario.faceReference) {
    throw new HttpError(400, "Face ID no está configurado para esta cuenta, usa tu contraseña");
  }

  // Se compara contra las dos fotos de referencia (foto del DNI + selfie de
  // verificación) y se usa la que dé la señal más fuerte — cada foto de
  // referencia tiene iluminación/ángulo distintos, así que esto es más
  // tolerante que exigir coincidencia contra una sola foto específica. Se
  // ejecutan en secuencia: el plan gratuito de Face++ rechaza solicitudes
  // concurrentes de la misma clave de API (CONCURRENCY_LIMIT_EXCEEDED)
  // cuando ambas llamadas se disparan en paralelo.
  const contraDni = await compareFaces({ base64: entrada.selfie }, { url: usuario.faceReference.dniPhotoUrl });
  const contraSelfie = await compareFaces({ base64: entrada.selfie }, { url: usuario.faceReference.selfiePhotoUrl });
  const mejorResultado = contraDni.confidence >= contraSelfie.confidence ? contraDni : contraSelfie;

  if (!mejorResultado.matched) {
    await registrarIntentoFallido(usuario, metaSolicitud, errorInvalido);
  }

  await registrarLoginExitoso(usuario, metaSolicitud, "face_id");

  const tokens = await emitirParDeTokens(usuario.id, usuario.email, metaSolicitud);
  return { user: aUsuarioPublico(usuario), ...tokens };
}

export async function refrescarSesion(refreshToken: string, metaSolicitud: RequestMeta) {
  const hashDelToken = hashToken(refreshToken);
  const guardado = await prisma.refreshToken.findUnique({ where: { tokenHash: hashDelToken }, include: { user: true } });

  if (!guardado || guardado.revokedAt || guardado.expiresAt < new Date()) {
    // Si se reproduce un token revocado/expirado, puede que esté robado —
    // por precaución se revocan todas las demás sesiones activas de este
    // usuario (detección de reutilización).
    if (guardado?.userId) {
      await prisma.refreshToken.updateMany({
        where: { userId: guardado.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw new HttpError(401, "Sesión inválida, inicia sesión nuevamente");
  }

  const nuevoRefreshToken = generateRefreshToken();
  const nuevoHashToken = hashToken(nuevoRefreshToken);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: guardado.id },
      data: { revokedAt: new Date(), replacedByTokenHash: nuevoHashToken },
    }),
    prisma.refreshToken.create({
      data: {
        userId: guardado.userId,
        tokenHash: nuevoHashToken,
        expiresAt: refreshTtlToDate(),
        ip: metaSolicitud.ip,
        userAgent: metaSolicitud.userAgent,
      },
    }),
  ]);

  const accessToken = signAccessToken({ sub: guardado.user.id, email: guardado.user.email });
  return { accessToken, refreshToken: nuevoRefreshToken, user: aUsuarioPublico(guardado.user) };
}

export async function solicitarRestablecerContrasena(entrada: EntradaSolicitarRestablecerContrasena) {
  const usuario = await prisma.user.findUnique({ where: { email: entrada.email } });

  // A propósito revela que *algo* está mal con este correo (sin decir si no
  // está registrado, está inactivo, u otra razón) para que la app pueda
  // detener el flujo aquí en vez de fingir que se envió un código. Es una
  // decisión de producto que se sacrifica frente al endurecimiento
  // tradicional contra enumeración de usuarios (una respuesta 204 genérica
  // siempre) — el mensaje es intencionalmente vago para no confirmar cuál
  // caso específico aplica.
  if (!usuario || !usuario.isActive) {
    throw new HttpError(404, "Esta cuenta no está disponible en este momento.");
  }

  await requestPasswordResetOtp(entrada.email);
}

export async function confirmarRestablecerContrasena(entrada: EntradaConfirmarRestablecerContrasena) {
  await verifyPasswordResetOtp(entrada.email, entrada.code);

  const usuario = await prisma.user.findUnique({ where: { email: entrada.email } });
  if (!usuario) {
    throw new HttpError(400, "No se pudo restablecer la contraseña, solicita un nuevo código");
  }

  const hashContrasena = await bcrypt.hash(entrada.newPassword, RONDAS_SAL_CONTRASENA);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuario.id },
      data: { passwordHash: hashContrasena, failedLoginAttempts: 0, lockedUntil: null },
    }),
    // Restablecer la contraseña es una señal fuerte de que cualquier sesión
    // existente puede que ya no sea del titular de la cuenta — se cierra la
    // sesión en todos los dispositivos, igual que un refresh token robado
    // lo dispara en refrescarSesion() arriba.
    prisma.refreshToken.updateMany({
      where: { userId: usuario.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await recordAudit({ userId: usuario.id, category: "SESION", action: "password_reset_confirmed" });
}

export async function cerrarSesion(refreshToken: string, metaSolicitud: RequestMeta) {
  const hashDelToken = hashToken(refreshToken);
  const guardado = await prisma.refreshToken.findUnique({ where: { tokenHash: hashDelToken } });

  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashDelToken, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (guardado?.userId) {
    await recordAudit({ userId: guardado.userId, category: "SESION", action: "logout", meta: metaSolicitud });
  }
}
