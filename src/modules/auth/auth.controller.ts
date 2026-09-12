import { Request, Response } from "express";
import { loginSchema, refreshSchema, registerSchema } from "./auth.validators";
import * as authService from "./auth.service";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { prisma } from "../../lib/prisma";

function meta(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

export async function registerHandler(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input, meta(req));
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, meta(req));
  res.status(200).json(result);
}

export async function refreshHandler(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await authService.refresh(refreshToken, meta(req));
  res.status(200).json(result);
}

export async function logoutHandler(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).send();
}

export async function meHandler(req: AuthenticatedRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  res.json({ id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, dni: user.dni });
}
