import { Response } from "express";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import * as servicioSeguridad from "./seguridad.servicio";
import { esquemaParametrosRevocarSesion, esquemaTokenSesion, esquemaActualizarAlertas, esquemaActualizarLimites } from "./seguridad.validadores";
import { obtenerMetaSolicitud } from "../../libreria/metaSolicitud";

export async function manejadorObtenerAlertas(peticion: SolicitudAutenticada, respuesta: Response) {
  respuesta.json(await servicioSeguridad.obtenerAlertas(peticion.user!.id));
}

export async function manejadorActualizarAlertas(peticion: SolicitudAutenticada, respuesta: Response) {
  const entrada = esquemaActualizarAlertas.parse(peticion.body);
  respuesta.json(await servicioSeguridad.actualizarAlertas(peticion.user!.id, entrada, obtenerMetaSolicitud(peticion)));
}

export async function manejadorObtenerLimites(peticion: SolicitudAutenticada, respuesta: Response) {
  respuesta.json(await servicioSeguridad.obtenerLimites(peticion.user!.id));
}

export async function manejadorActualizarLimites(peticion: SolicitudAutenticada, respuesta: Response) {
  const entrada = esquemaActualizarLimites.parse(peticion.body);
  respuesta.json(await servicioSeguridad.actualizarLimites(peticion.user!.id, entrada, obtenerMetaSolicitud(peticion)));
}

export async function manejadorListarSesiones(peticion: SolicitudAutenticada, respuesta: Response) {
  const { refreshToken } = esquemaTokenSesion.parse(peticion.body);
  const items = await servicioSeguridad.listarSesiones(peticion.user!.id, refreshToken);
  respuesta.json({ items });
}

export async function manejadorRevocarSesion(peticion: SolicitudAutenticada, respuesta: Response) {
  const { id } = esquemaParametrosRevocarSesion.parse(peticion.params);
  await servicioSeguridad.revocarSesion(peticion.user!.id, id, obtenerMetaSolicitud(peticion));
  respuesta.status(204).send();
}

export async function manejadorRevocarOtrasSesiones(peticion: SolicitudAutenticada, respuesta: Response) {
  const { refreshToken } = esquemaTokenSesion.parse(peticion.body);
  await servicioSeguridad.revocarOtrasSesiones(peticion.user!.id, refreshToken, obtenerMetaSolicitud(peticion));
  respuesta.status(204).send();
}
