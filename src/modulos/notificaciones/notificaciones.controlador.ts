import { Response } from "express";
import { z } from "zod";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import * as servicioNotificaciones from "./notificaciones.servicio";

export async function manejadorListarNotificaciones(peticion: SolicitudAutenticada, respuesta: Response) {
  const solicitado = Number(peticion.query.limit);
  const limite = Number.isFinite(solicitado) && solicitado > 0 ? Math.min(solicitado, 200) : 50;
  const items = await servicioNotificaciones.listarNotificaciones(peticion.user!.id, limite);
  respuesta.json({ items });
}

export async function manejadorMarcarTodasLeidas(peticion: SolicitudAutenticada, respuesta: Response) {
  await servicioNotificaciones.marcarTodasLeidas(peticion.user!.id);
  respuesta.status(204).send();
}

const esquemaParametros = z.object({ id: z.string().uuid() });

export async function manejadorMarcarLeida(peticion: SolicitudAutenticada, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  await servicioNotificaciones.marcarLeida(peticion.user!.id, id);
  respuesta.status(204).send();
}

export async function manejadorEliminarTodas(peticion: SolicitudAutenticada, respuesta: Response) {
  await servicioNotificaciones.eliminarTodas(peticion.user!.id);
  respuesta.status(204).send();
}
