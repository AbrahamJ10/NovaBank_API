import { Response } from "express";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import * as servicioQr from "./qr.servicio";
import { esquemaPagoQr } from "./qr.validadores";
import { obtenerMetaSolicitud } from "../../libreria/metaSolicitud";

export async function manejadorPagoQr(peticion: SolicitudAutenticada, respuesta: Response) {
  const entrada = esquemaPagoQr.parse(peticion.body);
  const recibo = await servicioQr.pagarQr(peticion.user!.id, entrada, obtenerMetaSolicitud(peticion));
  respuesta.status(201).json(recibo);
}
