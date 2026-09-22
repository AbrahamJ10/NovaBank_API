import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middleware/errorHandler";
import { requestProfileOtp as sendProfileOtp, verifyProfileOtp } from "../verification/otp.service";
import type { UpdateEmailInput, UpdatePasswordInput, UpdatePhoneInput } from "./profile.validators";
import { recordAudit } from "../audit/audit.service";
import type { RequestMeta } from "../../lib/requestMeta";

const PASSWORD_SALT_ROUNDS = 12;

function toPublicUser(user: { id: string; email: string; fullName: string; phone: string | null; dni: string | null }) {
  return { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, dni: user.dni };
}

// Todo cambio de perfil (correo/teléfono/contraseña) se confirma con un
// código enviado al correo ACTUAL verificado de la cuenta — prueba que
// quien hace el cambio controla la cuenta ya registrada, sin importar cuál
// campo esté cambiando.
export async function requestProfileOtp(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await sendProfileOtp(user.email);
}

export async function updateEmail(userId: string, input: UpdateEmailInput, meta?: RequestMeta) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (input.newEmail === user.email) {
    throw new HttpError(400, "Ese ya es tu correo actual");
  }

  const taken = await prisma.user.findUnique({ where: { email: input.newEmail } });
  if (taken) {
    throw new HttpError(409, "Ese correo ya está en uso por otra cuenta");
  }

  await verifyProfileOtp(user.email, input.otpCode);

  const updated = await prisma.user.update({ where: { id: userId }, data: { email: input.newEmail } });
  await recordAudit({
    userId,
    category: "PERFIL",
    action: "email_updated",
    metadata: { previousEmail: user.email, newEmail: input.newEmail },
    meta,
  });
  return toPublicUser(updated);
}

export async function updatePhone(userId: string, input: UpdatePhoneInput, meta?: RequestMeta) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (input.newPhone === user.phone) {
    throw new HttpError(400, "Ese ya es tu número actual");
  }

  const taken = await prisma.user.findUnique({ where: { phone: input.newPhone } });
  if (taken) {
    throw new HttpError(409, "Ese número ya está en uso por otra cuenta");
  }

  await verifyProfileOtp(user.email, input.otpCode);

  const updated = await prisma.user.update({ where: { id: userId }, data: { phone: input.newPhone } });
  await recordAudit({
    userId,
    category: "PERFIL",
    action: "phone_updated",
    metadata: { previousPhone: user.phone, newPhone: input.newPhone },
    meta,
  });
  return toPublicUser(updated);
}

export async function updatePassword(userId: string, input: UpdatePasswordInput, meta?: RequestMeta): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) {
    await recordAudit({ userId, category: "PERFIL", action: "password_update_failed_wrong_current", success: false, meta });
    throw new HttpError(401, "Tu contraseña actual no es correcta");
  }

  await verifyProfileOtp(user.email, input.otpCode);

  const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await recordAudit({ userId, category: "PERFIL", action: "password_updated", meta });
}
