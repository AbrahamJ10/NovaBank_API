import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as profileService from "./profile.service";
import { updateEmailSchema, updatePasswordSchema, updatePhoneSchema } from "./profile.validators";

export async function requestProfileOtpHandler(req: AuthenticatedRequest, res: Response) {
  await profileService.requestProfileOtp(req.user!.id);
  res.status(204).send();
}

export async function updateEmailHandler(req: AuthenticatedRequest, res: Response) {
  const input = updateEmailSchema.parse(req.body);
  const user = await profileService.updateEmail(req.user!.id, input);
  res.json({ user });
}

export async function updatePhoneHandler(req: AuthenticatedRequest, res: Response) {
  const input = updatePhoneSchema.parse(req.body);
  const user = await profileService.updatePhone(req.user!.id, input);
  res.json({ user });
}

export async function updatePasswordHandler(req: AuthenticatedRequest, res: Response) {
  const input = updatePasswordSchema.parse(req.body);
  await profileService.updatePassword(req.user!.id, input);
  res.status(204).send();
}
