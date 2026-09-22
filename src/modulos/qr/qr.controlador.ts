import { Response } from "express";
import type { AuthenticatedRequest } from "../../intermediarios/requerirAutenticacion";
import * as servicioQr from "./qr.servicio";
import { esquemaPagoQr } from "./qr.validadores";
import { getRequestMeta } from "../../libreria/metaSolicitud";

export async function manejadorPagoQr(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaPagoQr.parse(peticion.body);
  const recibo = await servicioQr.pagarQr(peticion.user!.id, entrada, getRequestMeta(peticion));
  respuesta.status(201).json(recibo);
}
