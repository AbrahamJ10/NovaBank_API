import { Response } from "express";
import type { AuthenticatedRequest } from "../../intermediarios/requerirAutenticacion";
import * as servicioTransacciones from "./transacciones.servicio";

export async function manejadorListarTransacciones(peticion: AuthenticatedRequest, respuesta: Response) {
  const solicitado = Number(peticion.query.limit);
  const limite = Number.isFinite(solicitado) && solicitado > 0 ? Math.min(solicitado, 200) : 50;
  const items = await servicioTransacciones.listarTransacciones(peticion.user!.id, limite);
  respuesta.json({ items });
}
