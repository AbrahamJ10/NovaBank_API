import { Response } from "express";
import type { AuthenticatedRequest } from "../../intermediarios/requerirAutenticacion";
import * as servicioSeguridad from "./seguridad.servicio";
import { esquemaParametrosRevocarSesion, esquemaTokenSesion, esquemaActualizarAlertas, esquemaActualizarLimites } from "./seguridad.validadores";
import { getRequestMeta } from "../../libreria/metaSolicitud";

export async function manejadorObtenerAlertas(peticion: AuthenticatedRequest, respuesta: Response) {
  respuesta.json(await servicioSeguridad.obtenerAlertas(peticion.user!.id));
}

export async function manejadorActualizarAlertas(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaActualizarAlertas.parse(peticion.body);
  respuesta.json(await servicioSeguridad.actualizarAlertas(peticion.user!.id, entrada, getRequestMeta(peticion)));
}

export async function manejadorObtenerLimites(peticion: AuthenticatedRequest, respuesta: Response) {
  respuesta.json(await servicioSeguridad.obtenerLimites(peticion.user!.id));
}

export async function manejadorActualizarLimites(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaActualizarLimites.parse(peticion.body);
  respuesta.json(await servicioSeguridad.actualizarLimites(peticion.user!.id, entrada, getRequestMeta(peticion)));
}

export async function manejadorListarSesiones(peticion: AuthenticatedRequest, respuesta: Response) {
  const { refreshToken } = esquemaTokenSesion.parse(peticion.body);
  const items = await servicioSeguridad.listarSesiones(peticion.user!.id, refreshToken);
  respuesta.json({ items });
}

export async function manejadorRevocarSesion(peticion: AuthenticatedRequest, respuesta: Response) {
  const { id } = esquemaParametrosRevocarSesion.parse(peticion.params);
  await servicioSeguridad.revocarSesion(peticion.user!.id, id, getRequestMeta(peticion));
  respuesta.status(204).send();
}

export async function manejadorRevocarOtrasSesiones(peticion: AuthenticatedRequest, respuesta: Response) {
  const { refreshToken } = esquemaTokenSesion.parse(peticion.body);
  await servicioSeguridad.revocarOtrasSesiones(peticion.user!.id, refreshToken, getRequestMeta(peticion));
  respuesta.status(204).send();
}
