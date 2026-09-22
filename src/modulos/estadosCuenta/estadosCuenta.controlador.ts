import { Response } from "express";
import type { AuthenticatedRequest } from "../../intermediarios/requerirAutenticacion";
import * as servicioEstadoCuenta from "./estadosCuenta.servicio";
import { esquemaEnviarEstadoCuenta } from "./estadosCuenta.validadores";

export async function manejadorEnviarEstadoCuenta(peticion: AuthenticatedRequest, respuesta: Response) {
  const entrada = esquemaEnviarEstadoCuenta.parse(peticion.body);
  await servicioEstadoCuenta.enviarEstadoCuenta(peticion.user!.id, entrada);
  respuesta.status(204).send();
}
