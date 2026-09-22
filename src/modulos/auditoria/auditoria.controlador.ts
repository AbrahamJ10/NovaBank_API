import { Response } from "express";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import { obtenerMetaSolicitud } from "../../libreria/metaSolicitud";
import * as servicioAuditoria from "./auditoria.servicio";
import { esquemaRegistrarEventos } from "./auditoria.validadores";

export async function manejadorRegistrarEventos(peticion: SolicitudAutenticada, respuesta: Response) {
  const { events } = esquemaRegistrarEventos.parse(peticion.body);
  await servicioAuditoria.recordClientEvents(peticion.user!.id, events, obtenerMetaSolicitud(peticion));
  respuesta.status(204).send();
}
