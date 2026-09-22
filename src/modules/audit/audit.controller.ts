import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { getRequestMeta } from "../../lib/requestMeta";
import * as servicioAuditoria from "./audit.service";
import { esquemaRegistrarEventos } from "./audit.validators";

export async function manejadorRegistrarEventos(peticion: AuthenticatedRequest, respuesta: Response) {
  const { events } = esquemaRegistrarEventos.parse(peticion.body);
  await servicioAuditoria.recordClientEvents(peticion.user!.id, events, getRequestMeta(peticion));
  respuesta.status(204).send();
}
