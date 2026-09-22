import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as servicioQr from "./qr.service";
import { esquemaPagoQr } from "./qr.validators";
import { getRequestMeta } from "../../lib/requestMeta";

export async function manejadorPagoQr(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaPagoQr.parse(peticion.body);
  const recibo = await servicioQr.pagarQr(peticion.user!.id, entrada, getRequestMeta(peticion));
  respuesta.status(201).json(recibo);
}
