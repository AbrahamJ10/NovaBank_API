import { Response } from "express";
import type { AuthenticatedRequest } from "../../intermediarios/requerirAutenticacion";
import * as servicioPerfil from "./perfil.servicio";
import { esquemaActualizarCorreo, esquemaActualizarContrasena, esquemaActualizarTelefono } from "./perfil.validadores";
import { getRequestMeta } from "../../libreria/metaSolicitud";

export async function manejadorSolicitarOtpPerfil(peticion: AuthenticatedRequest, respuesta: Response) {
  await servicioPerfil.solicitarOtpPerfil(peticion.user!.id);
  respuesta.status(204).send();
}

export async function manejadorActualizarCorreo(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaActualizarCorreo.parse(peticion.body);
  const usuario = await servicioPerfil.actualizarCorreo(peticion.user!.id, entrada, getRequestMeta(peticion));
  respuesta.json({ user: usuario });
}

export async function manejadorActualizarTelefono(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaActualizarTelefono.parse(peticion.body);
  const usuario = await servicioPerfil.actualizarTelefono(peticion.user!.id, entrada, getRequestMeta(peticion));
  respuesta.json({ user: usuario });
}

export async function manejadorActualizarContrasena(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaActualizarContrasena.parse(peticion.body);
  await servicioPerfil.actualizarContrasena(peticion.user!.id, entrada, getRequestMeta(peticion));
  respuesta.status(204).send();
}
