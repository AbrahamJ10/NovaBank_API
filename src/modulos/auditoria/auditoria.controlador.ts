import { Response } from "express";
import type { AuthenticatedRequest } from "../../intermediarios/requerirAutenticacion";
import { getRequestMeta } from "../../libreria/metaSolicitud";
import * as servicioAuditoria from "./auditoria.servicio";
import { esquemaRegistrarEventos } from "./auditoria.validadores";

export async function manejadorRegistrarEventos(peticion: AuthenticatedRequest, respuesta: Response) {
  const { events } = esquemaRegistrarEventos.parse(peticion.body);
  await servicioAuditoria.recordClientEvents(peticion.user!.id, events, getRequestMeta(peticion));
  respuesta.status(204).send();
}
