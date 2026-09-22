import { Request, Response } from "express";
import {
  esquemaLoginFacial,
  esquemaLogin,
  esquemaConfirmarRestablecerContrasena,
  esquemaSolicitarRestablecerContrasena,
  esquemaRefrescar,
  esquemaRegistro,
} from "./autenticacion.validadores";
import * as servicioAuth from "./autenticacion.servicio";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import { prisma } from "../../libreria/prisma";
import { obtenerMetaSolicitud as obtenerMeta } from "../../libreria/metaSolicitud";

export async function manejadorRegistro(peticion: Request, respuesta: Response) {
  const entrada = esquemaRegistro.parse(peticion.body);
  const resultado = await servicioAuth.registrar(entrada, obtenerMeta(peticion));
  respuesta.status(201).json(resultado);
}

export async function manejadorLogin(peticion: Request, respuesta: Response) {
  const entrada = esquemaLogin.parse(peticion.body);
  const resultado = await servicioAuth.iniciarSesion(entrada, obtenerMeta(peticion));
  respuesta.status(200).json(resultado);
}

export async function manejadorLoginFacial(peticion: Request, respuesta: Response) {
  const entrada = esquemaLoginFacial.parse(peticion.body);
  const resultado = await servicioAuth.iniciarSesionConRostro(entrada, obtenerMeta(peticion));
  respuesta.status(200).json(resultado);
}

export async function manejadorSolicitarRestablecerContrasena(peticion: Request, respuesta: Response) {
  const entrada = esquemaSolicitarRestablecerContrasena.parse(peticion.body);
  await servicioAuth.solicitarRestablecerContrasena(entrada);
  respuesta.status(204).send();
}

export async function manejadorConfirmarRestablecerContrasena(peticion: Request, respuesta: Response) {
  const entrada = esquemaConfirmarRestablecerContrasena.parse(peticion.body);
  await servicioAuth.confirmarRestablecerContrasena(entrada);
  respuesta.status(204).send();
}

export async function manejadorRefrescar(peticion: Request, respuesta: Response) {
  const { refreshToken } = esquemaRefrescar.parse(peticion.body);
  const resultado = await servicioAuth.refrescarSesion(refreshToken, obtenerMeta(peticion));
  respuesta.status(200).json(resultado);
}

export async function manejadorCerrarSesion(peticion: Request, respuesta: Response) {
  const { refreshToken } = esquemaRefrescar.parse(peticion.body);
  await servicioAuth.cerrarSesion(refreshToken, obtenerMeta(peticion));
  respuesta.status(204).send();
}

export async function manejadorPerfilPropio(peticion: SolicitudAutenticada, respuesta: Response) {
  const usuario = await prisma.user.findUnique({ where: { id: peticion.user!.id } });
  if (!usuario) {
    respuesta.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  respuesta.json({ id: usuario.id, email: usuario.email, fullName: usuario.fullName, phone: usuario.phone, dni: usuario.dni });
}
