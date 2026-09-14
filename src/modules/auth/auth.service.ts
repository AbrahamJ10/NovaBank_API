import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import {
  generateRefreshToken,
  hashToken,
  refreshTtlToDate,
  signAccessToken,
} from "../../lib/jwt";
import type { FaceLoginInput, LoginInput, RegisterInput } from "./auth.validators";
import { verifyRegisterOtp } from "../verification/otp.service";
import { compareFaces } from "../verification/face.service";
import { uploadFaceReference } from "../../lib/cloudinary";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

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

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
      dni: input.dni,
    },
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
    throw new HttpError(423, "Cuenta bloqueada temporalmente por demasiados intentos fallidos", {
      lockedUntil: user.lockedUntil.toISOString(),
    });
  }

  if (!user.isActive) {
    await prisma.loginEvent.create({
      data: { userId: user.id, email: user.email, result: "ACCOUNT_INACTIVE", ip: meta.ip, userAgent: meta.userAgent },
    });
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

  if (shouldLock) {
    throw new HttpError(423, "Cuenta bloqueada temporalmente por demasiados intentos fallidos", {
      lockedUntil: lockedUntil!.toISOString(),
    });
  }
  throw invalidError();
}

async function registerSuccess(user: NonNullable<UserRecord>, meta: RequestMeta) {
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  await prisma.loginEvent.create({
    data: { userId: user.id, email: user.email, result: "SUCCESS", ip: meta.ip, userAgent: meta.userAgent },
  });
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
    throw invalidCredentialsError();
  }

  await assertLoginAllowed(user, meta);

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    await registerFailedAttempt(user, meta, invalidCredentialsError);
  }

  await registerSuccess(user, meta);

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

  await registerSuccess(user, meta);

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

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
