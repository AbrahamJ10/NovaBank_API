import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as servicioTransferencias from "./transfers.service";
import { getRequestMeta } from "../../lib/requestMeta";

export async function manejadorSolicitarOtpTransferencia(peticion: AuthenticatedRequest, respuesta: Response) {
  await servicioTransferencias.solicitarTransferencia(peticion.user!.email);
  respuesta.status(204).send();
}

const esquemaEjecutar = z.object({
  payeeId: z.string().uuid(),
  amount: z.number().positive(),
  concept: z.string().trim().min(1).max(140),
  otpCode: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});

export async function manejadorEjecutarTransferencia(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaEjecutar.parse(peticion.body);
  const recibo = await servicioTransferencias.ejecutarTransferencia(peticion.user!.id, peticion.user!.email, entrada, getRequestMeta(peticion));
  respuesta.status(201).json(recibo);
}
