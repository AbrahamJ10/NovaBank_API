import { Response, Request } from "express";
import { z } from "zod";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import * as servicioRecibos from "./recibos.servicio";
import { esquemaAfiliacion } from "./recibos.validadores";
import { obtenerMetaSolicitud } from "../../libreria/metaSolicitud";

export async function manejadorObtenerCatalogo(_peticion: Request, respuesta: Response) {
  const items = await servicioRecibos.obtenerCatalogo();
  respuesta.json({ items });
}

export async function manejadorListarRecibos(peticion: SolicitudAutenticada, respuesta: Response) {
  const items = await servicioRecibos.listarRecibos(peticion.user!.id);
  respuesta.json({ items });
}

export async function manejadorAfiliar(peticion: SolicitudAutenticada, respuesta: Response) {
  const entrada = esquemaAfiliacion.parse(peticion.body);
  const recibo = await servicioRecibos.afiliarServicio(peticion.user!.id, entrada.billerKey, entrada.supplyNumber, obtenerMetaSolicitud(peticion));
  respuesta.status(201).json(recibo);
}

const esquemaParametros = z.object({ id: z.string().uuid() });

export async function manejadorPagarRecibo(peticion: SolicitudAutenticada, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  await servicioRecibos.pagarRecibo(peticion.user!.id, id, obtenerMetaSolicitud(peticion));
  respuesta.status(204).send();
}

export async function manejadorSuspenderServicio(peticion: SolicitudAutenticada, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  const recibo = await servicioRecibos.suspenderServicio(peticion.user!.id, id, obtenerMetaSolicitud(peticion));
  respuesta.json(recibo);
}

export async function manejadorReanudarServicio(peticion: SolicitudAutenticada, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  const recibo = await servicioRecibos.reanudarServicio(peticion.user!.id, id, obtenerMetaSolicitud(peticion));
  respuesta.json(recibo);
}
