import { Response } from "express";
import { z } from "zod";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import * as servicioRetiros from "./retiros.servicio";
import { obtenerMetaSolicitud } from "../../libreria/metaSolicitud";

const esquemaCrear = z.object({ amount: z.number().positive() });

export async function manejadorCrearRetiro(peticion: SolicitudAutenticada, respuesta: Response) {
  const { amount } = esquemaCrear.parse(peticion.body);
  const retiro = await servicioRetiros.crearRetiro(peticion.user!.id, amount, obtenerMetaSolicitud(peticion));
  respuesta.status(201).json(retiro);
}

const esquemaParametros = z.object({ id: z.string().uuid() });

export async function manejadorCancelarRetiro(peticion: SolicitudAutenticada, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  await servicioRetiros.cancelarRetiro(peticion.user!.id, id, obtenerMetaSolicitud(peticion));
  respuesta.status(204).send();
}

export async function manejadorRenovarRetiro(peticion: SolicitudAutenticada, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  const retiro = await servicioRetiros.renovarRetiro(peticion.user!.id, id, obtenerMetaSolicitud(peticion));
  respuesta.json(retiro);
}
