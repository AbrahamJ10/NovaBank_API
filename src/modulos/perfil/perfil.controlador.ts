import { Response } from "express";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import * as servicioPerfil from "./perfil.servicio";
import { esquemaActualizarCorreo, esquemaActualizarContrasena, esquemaActualizarTelefono } from "./perfil.validadores";
import { obtenerMetaSolicitud } from "../../libreria/metaSolicitud";

export async function manejadorSolicitarOtpPerfil(peticion: SolicitudAutenticada, respuesta: Response) {
  await servicioPerfil.solicitarOtpPerfil(peticion.user!.id);
  respuesta.status(204).send();
}

export async function manejadorActualizarCorreo(peticion: SolicitudAutenticada, respuesta: Response) {
  const entrada = esquemaActualizarCorreo.parse(peticion.body);
  const usuario = await servicioPerfil.actualizarCorreo(peticion.user!.id, entrada, obtenerMetaSolicitud(peticion));
  respuesta.json({ user: usuario });
}

export async function manejadorActualizarTelefono(peticion: SolicitudAutenticada, respuesta: Response) {
  const entrada = esquemaActualizarTelefono.parse(peticion.body);
  const usuario = await servicioPerfil.actualizarTelefono(peticion.user!.id, entrada, obtenerMetaSolicitud(peticion));
  respuesta.json({ user: usuario });
}

export async function manejadorActualizarContrasena(peticion: SolicitudAutenticada, respuesta: Response) {
  const entrada = esquemaActualizarContrasena.parse(peticion.body);
  await servicioPerfil.actualizarContrasena(peticion.user!.id, entrada, obtenerMetaSolicitud(peticion));
  respuesta.status(204).send();
}
