import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import {
  generateRefreshToken,
  hashToken,
  refreshTtlToDate,
  signAccessToken,
} from "../../lib/jwt";
import type { LoginInput, RegisterInput } from "./auth.validators";
import { verifyRegisterOtp } from "../verification/otp.service";

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

  const tokens = await issueTokenPair(user.id, user.email, meta);
  return { user: toPublicUser(user), ...tokens };
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

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
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
    throw invalidCredentialsError();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  await prisma.loginEvent.create({
    data: { userId: user.id, email: user.email, result: "SUCCESS", ip: meta.ip, userAgent: meta.userAgent },
  });

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
