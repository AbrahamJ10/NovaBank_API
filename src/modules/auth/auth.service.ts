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
import { createAccountForUser } from "../account/account.service";
import { seedDefaultPayees } from "../payees/payees.service";
import { seedDefaultBills } from "../bills/bills.service";
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

  // The account (balance/card/transactions ledger) is core to the app
  // working at all, so it's created atomically with the user — if either
  // fails, both roll back rather than leaving an account-less user behind.
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
    await createAccountForUser(tx, created.id);
    await seedDefaultPayees(tx, created.id);
    await seedDefaultBills(tx, created.id);
    return created;
  });

  // Best-effort: a face reference isn't required to have an account, only
  // to use Face ID login later. Don't fail registration over it.
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

// Shared between password login and Face ID login — the lockout must apply
// regardless of which factor an attacker is trying, or Face ID becomes a
// side door around the password brute-force protection.
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

  // Same generic error whether the email doesn't exist or the password is
  // wrong — avoids leaking which emails are registered (user enumeration).
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

  // Compare against both reference photos (DNI photo + verification selfie)
  // and go with whichever gives the strongest signal — different reference
  // shots have different lighting/angle, so this is more forgiving than
  // requiring a match against one specific photo. Run sequentially: Face++'s
  // free tier rejects concurrent requests from the same API key
  // (CONCURRENCY_LIMIT_EXCEEDED) when both calls fire in parallel.
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
    // If a revoked/expired token is replayed, it may be stolen — revoke every
    // other active session for this user as a precaution (reuse detection).
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

  // Deliberately reveals that *something* is wrong with this email (without
  // saying whether it's unregistered, inactive, or something else) so the
  // app can stop the flow here instead of pretending a code was sent. This
  // is a product choice traded against textbook user-enumeration hardening
  // (a generic always-204 response) — the message is intentionally vague so
  // it doesn't confirm which specific case applies.
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
    // A password reset is a strong signal any existing session may not be
    // the account holder anymore — sign out every device, same as a stolen
    // refresh token triggers in refresh() above.
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
