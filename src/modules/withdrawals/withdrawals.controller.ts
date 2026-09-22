import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as servicioRetiros from "./withdrawals.service";
import { getRequestMeta } from "../../lib/requestMeta";

const esquemaCrear = z.object({ amount: z.number().positive() });

export async function manejadorCrearRetiro(peticion: AuthenticatedRequest, respuesta: Response) {
  const { amount } = esquemaCrear.parse(peticion.body);
  const retiro = await servicioRetiros.crearRetiro(peticion.user!.id, amount, getRequestMeta(peticion));
  respuesta.status(201).json(retiro);
}

const esquemaParametros = z.object({ id: z.string().uuid() });

export async function manejadorCancelarRetiro(peticion: AuthenticatedRequest, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  await servicioRetiros.cancelarRetiro(peticion.user!.id, id, getRequestMeta(peticion));
  respuesta.status(204).send();
}

export async function manejadorRenovarRetiro(peticion: AuthenticatedRequest, respuesta: Response) {
  const { id } = esquemaParametros.parse(peticion.params);
  const retiro = await servicioRetiros.renovarRetiro(peticion.user!.id, id, getRequestMeta(peticion));
  respuesta.json(retiro);
}
