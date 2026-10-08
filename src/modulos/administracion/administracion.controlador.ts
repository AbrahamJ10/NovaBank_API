import { Request, Response } from "express";
import { z } from "zod";
import * as servicioAdmin from "./administracion.servicio";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import { obtenerMetaSolicitud } from "../../libreria/metaSolicitud";

const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export async function manejadorEstadisticas(_peticion: Request, respuesta: Response) {
  const datos = await servicioAdmin.obtenerEstadisticas();
  respuesta.json(datos);
}

export async function manejadorListarUsuarios(peticion: Request, respuesta: Response) {
  const { pagina, limite } = esquemaPaginacion.parse(peticion.query);
  const busqueda = typeof peticion.query.busqueda === "string" ? peticion.query.busqueda : undefined;
  const estado = typeof peticion.query.estado === "string" ? peticion.query.estado : undefined;
  const datos = await servicioAdmin.listarUsuarios({ busqueda, estado, pagina, limite });
  respuesta.json(datos);
}

export async function manejadorDetalleUsuario(peticion: Request, respuesta: Response) {
  const datos = await servicioAdmin.obtenerUsuarioDetalle(peticion.params.id);
  respuesta.json(datos);
}

const esquemaActualizarUsuario = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  dni: z.string().trim().max(15).optional().nullable(),
});

export async function manejadorActualizarUsuario(peticion: SolicitudAutenticada, respuesta: Response) {
  const datos = esquemaActualizarUsuario.parse(peticion.body);
  const actualizado = await servicioAdmin.actualizarUsuario(peticion.params.id, datos, peticion.user!.id, obtenerMetaSolicitud(peticion));
  respuesta.json(actualizado);
}

export async function manejadorSuspenderUsuario(peticion: SolicitudAutenticada, respuesta: Response) {
  const r = await servicioAdmin.suspenderUsuario(peticion.params.id, peticion.user!.id, obtenerMetaSolicitud(peticion));
  respuesta.json(r);
}

export async function manejadorActivarUsuario(peticion: SolicitudAutenticada, respuesta: Response) {
  const r = await servicioAdmin.activarUsuario(peticion.params.id, peticion.user!.id, obtenerMetaSolicitud(peticion));
  respuesta.json(r);
}

export async function manejadorDesbloquearUsuario(peticion: SolicitudAutenticada, respuesta: Response) {
  const r = await servicioAdmin.desbloquearUsuario(peticion.params.id, peticion.user!.id, obtenerMetaSolicitud(peticion));
  respuesta.json(r);
}

export async function manejadorEliminarUsuario(peticion: SolicitudAutenticada, respuesta: Response) {
  const r = await servicioAdmin.eliminarUsuario(peticion.params.id, peticion.user!.id, obtenerMetaSolicitud(peticion));
  respuesta.json(r);
}

export async function manejadorRestaurarUsuario(peticion: SolicitudAutenticada, respuesta: Response) {
  const r = await servicioAdmin.restaurarUsuario(peticion.params.id, peticion.user!.id, obtenerMetaSolicitud(peticion));
  respuesta.json(r);
}

export async function manejadorRestablecerContrasena(peticion: SolicitudAutenticada, respuesta: Response) {
  const r = await servicioAdmin.restablecerContrasenaUsuario(peticion.params.id, peticion.user!.id, obtenerMetaSolicitud(peticion));
  respuesta.json(r);
}

export async function manejadorListarEventosLogin(peticion: Request, respuesta: Response) {
  const { pagina, limite } = esquemaPaginacion.parse(peticion.query);
  const resultado = typeof peticion.query.resultado === "string" ? peticion.query.resultado : undefined;
  const correo = typeof peticion.query.correo === "string" ? peticion.query.correo : undefined;
  const datos = await servicioAdmin.listarEventosLogin({ resultado, correo, pagina, limite });
  respuesta.json(datos);
}

export async function manejadorListarAuditoria(peticion: Request, respuesta: Response) {
  const { pagina, limite } = esquemaPaginacion.parse(peticion.query);
  const categoria = typeof peticion.query.categoria === "string" ? peticion.query.categoria : undefined;
  const busqueda = typeof peticion.query.busqueda === "string" ? peticion.query.busqueda : undefined;
  const datos = await servicioAdmin.listarAuditoriaGlobal({ categoria, busqueda, pagina, limite });
  respuesta.json(datos);
}

export async function manejadorListarTransaccionesGlobal(peticion: Request, respuesta: Response) {
  const { pagina, limite } = esquemaPaginacion.parse(peticion.query);
  const datos = await servicioAdmin.listarTransaccionesGlobal({ pagina, limite });
  respuesta.json(datos);
}
