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
  FaceLoginInput,
  LoginInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  RegisterInput,
} from "./auth.validators";
import { requestPasswordResetOtp, verifyPasswordResetOtp, verifyRegisterOtp } from "../verification/otp.service";
import { crearCuentaParaUsuario } from "../account/account.service";
import { seedDefaultPayees } from "../payees/payees.service";
import { sembrarRecibosPorDefecto } from "../bills/bills.service";
import { compareFaces } from "../verification/face.service";
import { uploadFaceReference } from "../../lib/cloudinary";
import { createNotification } from "../notifications/notifications.service";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;

function toPublicUser(user: { id: string; email: string; fullName: string; phone: string | null; dni: string | null }) {
  return { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, dni: user.dni };
}

async function issueTokenPair(userId: string, email: string, meta: RequestMeta) {
  const accessToken = signAccessToken({ sub: userId, email });
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTtlToDate(),
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput, meta: RequestMeta) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, "Ya existe una cuenta con ese correo");
  }

  await verifyRegisterOtp(input.email, input.otpCode);

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

  // La cuenta (saldo/tarjeta/historial de transacciones) es esencial para
  // que la app funcione, así que se crea de forma atómica junto con el
  // usuario — si cualquiera de las dos falla, ambas se revierten en vez de
  // dejar un usuario sin cuenta.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        dni: input.dni,
      },
    });
    await crearCuentaParaUsuario(tx, created.id);
    await seedDefaultPayees(tx, created.id);
    await sembrarRecibosPorDefecto(tx, created.id);
    return created;
  });

  // Mejor esfuerzo: no se necesita una referencia facial para tener una
  // cuenta, solo para usar el login con Face ID después. No se debe fallar
  // el registro por esto.
  if (input.dniPhoto && input.selfie) {
    try {
      const [dniPhotoUrl, selfiePhotoUrl] = await Promise.all([
        uploadFaceReference(input.dniPhoto, `${user.id}-dni`),
        uploadFaceReference(input.selfie, `${user.id}-selfie`),
      ]);
      await prisma.faceReference.create({ data: { userId: user.id, dniPhotoUrl, selfiePhotoUrl } });
    } catch (err) {
      console.error("Failed to save face reference for", user.id, err);
    }
  }

  const tokens = await issueTokenPair(user.id, user.email, meta);
  await recordAudit({ userId: user.id, category: "SESION", action: "register", meta });
  return { user: toPublicUser(user), ...tokens };
}

type UserRecord = Awaited<ReturnType<typeof prisma.user.findUnique>>;

// Compartido entre el login con contraseña y el login con Face ID — el
// bloqueo debe aplicarse sin importar qué factor esté intentando un
// atacante, o Face ID se vuelve una puerta trasera alrededor de la
// protección contra fuerza bruta.
async function assertLoginAllowed(user: NonNullable<UserRecord>, meta: RequestMeta) {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await prisma.loginEvent.create({
      data: { userId: user.id, email: user.email, result: "ACCOUNT_LOCKED", ip: meta.ip, userAgent: meta.userAgent },
    });
    await recordAudit({ userId: user.id, category: "SESION", action: "login_blocked_locked", success: false, meta });
    throw new HttpError(423, "Cuenta bloqueada temporalmente por demasiados intentos fallidos", {
      lockedUntil: user.lockedUntil.toISOString(),
    });
  }

  if (!user.isActive) {
    await prisma.loginEvent.create({
      data: { userId: user.id, email: user.email, result: "ACCOUNT_INACTIVE", ip: meta.ip, userAgent: meta.userAgent },
    });
    await recordAudit({ userId: user.id, category: "SESION", action: "login_blocked_inactive", success: false, meta });
    throw new HttpError(403, "Cuenta inactiva");
  }
}

async function registerFailedAttempt(user: NonNullable<UserRecord>, meta: RequestMeta, invalidError: () => HttpError) {
  const failedLoginAttempts = user.failedLoginAttempts + 1;
  const shouldLock = failedLoginAttempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: shouldLock ? 0 : failedLoginAttempts, lockedUntil },
  });
  await prisma.loginEvent.create({
    data: {
      userId: user.id,
      email: user.email,
      result: shouldLock ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  await recordAudit({
    userId: user.id,
    category: "SESION",
    action: shouldLock ? "login_failed_now_locked" : "login_failed",
    success: false,
    metadata: { failedLoginAttempts },
    meta,
  });

  if (shouldLock) {
    throw new HttpError(423, "Cuenta bloqueada temporalmente por demasiados intentos fallidos", {
      lockedUntil: lockedUntil!.toISOString(),
    });
  }
  throw invalidError();
}

async function registerSuccess(user: NonNullable<UserRecord>, meta: RequestMeta, method: "password" | "face_id") {
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  await prisma.loginEvent.create({
    data: { userId: user.id, email: user.email, result: "SUCCESS", ip: meta.ip, userAgent: meta.userAgent },
  });
  await recordAudit({ userId: user.id, category: "SESION", action: "login_success", metadata: { method }, meta });
  if (user.alertLogin) {
    await createNotification(prisma, user.id, {
      title: "Nuevo inicio de sesión",
      body: meta.ip ? `Iniciaste sesión desde ${meta.ip}.` : "Iniciaste sesión con tu contraseña.",
      icon: "login",
      iconBg: "#EDF2F8",
      iconFg: "#133A63",
    });
  }
}

export async function login(input: LoginInput, meta: RequestMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // El mismo error genérico ya sea que el correo no exista o la contraseña
  // esté mal — evita revelar qué correos están registrados (enumeración de
  // usuarios).
  const invalidCredentialsError = () => new HttpError(401, "Correo o contraseña incorrectos");

  if (!user) {
    await prisma.loginEvent.create({
      data: { email: input.email, result: "INVALID_CREDENTIALS", ip: meta.ip, userAgent: meta.userAgent },
    });
    await recordAudit({
      category: "SESION",
      action: "login_failed_unknown_email",
      success: false,
      description: input.email,
      meta,
    });
    throw invalidCredentialsError();
  }

  await assertLoginAllowed(user, meta);

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    await registerFailedAttempt(user, meta, invalidCredentialsError);
  }

  await registerSuccess(user, meta, "password");

  const tokens = await issueTokenPair(user.id, user.email, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function faceLogin(input: FaceLoginInput, meta: RequestMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: { faceReference: true } });

  const invalidError = () => new HttpError(401, "No pudimos verificar tu identidad");

  if (!user) {
    await prisma.loginEvent.create({
      data: { email: input.email, result: "INVALID_CREDENTIALS", ip: meta.ip, userAgent: meta.userAgent },
    });
    await recordAudit({
      category: "SESION",
      action: "login_failed_unknown_email",
      success: false,
      description: input.email,
      metadata: { method: "face_id" },
      meta,
    });
    throw invalidError();
  }

  await assertLoginAllowed(user, meta);

  if (!user.faceReference) {
    throw new HttpError(400, "Face ID no está configurado para esta cuenta, usa tu contraseña");
  }

  // Se compara contra las dos fotos de referencia (foto del DNI + selfie de
  // verificación) y se usa la que dé la señal más fuerte — cada foto de
  // referencia tiene iluminación/ángulo distintos, así que esto es más
  // tolerante que exigir coincidencia contra una sola foto específica. Se
  // ejecutan en secuencia: el plan gratuito de Face++ rechaza solicitudes
  // concurrentes de la misma clave de API (CONCURRENCY_LIMIT_EXCEEDED)
  // cuando ambas llamadas se disparan en paralelo.
  const vsDni = await compareFaces({ base64: input.selfie }, { url: user.faceReference.dniPhotoUrl });
  const vsSelfie = await compareFaces({ base64: input.selfie }, { url: user.faceReference.selfiePhotoUrl });
  const best = vsDni.confidence >= vsSelfie.confidence ? vsDni : vsSelfie;

  if (!best.matched) {
    await registerFailedAttempt(user, meta, invalidError);
  }

  await registerSuccess(user, meta, "face_id");

  const tokens = await issueTokenPair(user.id, user.email, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(refreshToken: string, meta: RequestMeta) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    // Si se reproduce un token revocado/expirado, puede que esté robado —
    // por precaución se revocan todas las demás sesiones activas de este
    // usuario (detección de reutilización).
    if (stored?.userId) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw new HttpError(401, "Sesión inválida, inicia sesión nuevamente");
  }

  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRefreshToken);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenHash: newTokenHash },
    }),
    prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: newTokenHash,
        expiresAt: refreshTtlToDate(),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  const accessToken = signAccessToken({ sub: stored.user.id, email: stored.user.email });
  return { accessToken, refreshToken: newRefreshToken, user: toPublicUser(stored.user) };
}

export async function requestPasswordReset(input: PasswordResetRequestInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // A propósito revela que *algo* está mal con este correo (sin decir si no
  // está registrado, está inactivo, u otra razón) para que la app pueda
  // detener el flujo aquí en vez de fingir que se envió un código. Es una
  // decisión de producto que se sacrifica frente al endurecimiento
  // tradicional contra enumeración de usuarios (una respuesta 204 genérica
  // siempre) — el mensaje es intencionalmente vago para no confirmar cuál
  // caso específico aplica.
  if (!user || !user.isActive) {
    throw new HttpError(404, "Esta cuenta no está disponible en este momento.");
  }

  await requestPasswordResetOtp(input.email);
}

export async function confirmPasswordReset(input: PasswordResetConfirmInput) {
  await verifyPasswordResetOtp(input.email, input.code);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new HttpError(400, "No se pudo restablecer la contraseña, solicita un nuevo código");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    // Restablecer la contraseña es una señal fuerte de que cualquier sesión
    // existente puede que ya no sea del titular de la cuenta — se cierra la
    // sesión en todos los dispositivos, igual que un refresh token robado
    // lo dispara en refresh() arriba.
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await recordAudit({ userId: user.id, category: "SESION", action: "password_reset_confirmed" });
}

export async function logout(refreshToken: string, meta: RequestMeta) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (stored?.userId) {
    await recordAudit({ userId: stored.userId, category: "SESION", action: "logout", meta });
  }
}
