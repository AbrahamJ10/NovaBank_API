import { Response, Request } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as servicioRecibos from "./bills.service";
import { esquemaAfiliacion } from "./bills.validators";
import { getRequestMeta } from "../../lib/requestMeta";

export async function manejadorObtenerCatalogo(_peticion: Request, respuesta: Response) {
  const items = await servicioRecibos.obtenerCatalogo();
  respuesta.json({ items });
}

export async function manejadorListarRecibos(peticion: AuthenticatedRequest, respuesta: Response) {
  const items = await servicioRecibos.listarRecibos(peticion.user!.id);
  respuesta.json({ items });
}

export async function manejadorAfiliar(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaAfiliacion.parse(peticion.body);
  const recibo = await servicioRecibos.afiliarServicio(peticion.user!.id, entrada.billerKey, entrada.supplyNumber, getRequestMeta(peticion));
  respuesta.status(201).json(recibo);
}

const esquemaParametros = z.object({ id: z.string().uuid() });

export async function manejadorPagarRecibo(peticion: AuthenticatedRequest, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  await servicioRecibos.pagarRecibo(peticion.user!.id, id, getRequestMeta(peticion));
  respuesta.status(204).send();
}

export async function manejadorSuspenderServicio(peticion: AuthenticatedRequest, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  const recibo = await servicioRecibos.suspenderServicio(peticion.user!.id, id, getRequestMeta(peticion));
  respuesta.json(recibo);
}

export async function manejadorReanudarServicio(peticion: AuthenticatedRequest, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  const recibo = await servicioRecibos.reanudarServicio(peticion.user!.id, id, getRequestMeta(peticion));
  respuesta.json(recibo);
}
