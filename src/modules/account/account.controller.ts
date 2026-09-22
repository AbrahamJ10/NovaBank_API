import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import * as servicioCuenta from "./account.service";
import { getRequestMeta } from "../../lib/requestMeta";

export async function manejadorObtenerCuenta(peticion: AuthenticatedRequest, respuesta: Response) {
  const resumen = await servicioCuenta.obtenerResumenCuenta(peticion.user!.id);
  respuesta.json(resumen);
}

const esquemaBloqueoTarjeta = z.object({ blocked: z.boolean() });

export async function manejadorBloqueoTarjeta(peticion: AuthenticatedRequest, respuesta: Response) {
  const { blocked } = esquemaBloqueoTarjeta.parse(peticion.body);
  const tarjetaBloqueada = await servicioCuenta.establecerBloqueoTarjeta(peticion.user!.id, blocked, getRequestMeta(peticion));
  respuesta.json({ cardBlocked: tarjetaBloqueada });
}

const esquemaPagoTarjeta = z.object({ amount: z.number().positive() });

export async function manejadorPagoTarjeta(peticion: AuthenticatedRequest, respuesta: Response) {
  const { amount } = esquemaPagoTarjeta.parse(peticion.body);
  const resumen = await servicioCuenta.pagarTarjeta(peticion.user!.id, amount, getRequestMeta(peticion));
  respuesta.json(resumen);
}

const esquemaRevelarCvv = z.object({ otpCode: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos") });

export async function manejadorRevelarCvv(peticion: AuthenticatedRequest, respuesta: Response) {
  const { otpCode } = esquemaRevelarCvv.parse(peticion.body);
  const resultado = await servicioCuenta.revelarCvv(peticion.user!.id, otpCode, getRequestMeta(peticion));
  respuesta.json(resultado);
}
