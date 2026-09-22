import { Response } from "express";
import { z } from "zod";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import * as servicioCuenta from "./cuenta.servicio";
import { obtenerMetaSolicitud } from "../../libreria/metaSolicitud";

export async function manejadorObtenerCuenta(peticion: SolicitudAutenticada, respuesta: Response) {
  const resumen = await servicioCuenta.obtenerResumenCuenta(peticion.user!.id);
  respuesta.json(resumen);
}

const esquemaBloqueoTarjeta = z.object({ blocked: z.boolean() });

export async function manejadorBloqueoTarjeta(peticion: SolicitudAutenticada, respuesta: Response) {
  const { blocked } = esquemaBloqueoTarjeta.parse(peticion.body);
  const tarjetaBloqueada = await servicioCuenta.establecerBloqueoTarjeta(peticion.user!.id, blocked, obtenerMetaSolicitud(peticion));
  respuesta.json({ cardBlocked: tarjetaBloqueada });
}

const esquemaPagoTarjeta = z.object({ amount: z.number().positive() });

export async function manejadorPagoTarjeta(peticion: SolicitudAutenticada, respuesta: Response) {
  const { amount } = esquemaPagoTarjeta.parse(peticion.body);
  const resumen = await servicioCuenta.pagarTarjeta(peticion.user!.id, amount, obtenerMetaSolicitud(peticion));
  respuesta.json(resumen);
}

const esquemaRevelarCvv = z.object({ otpCode: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos") });

export async function manejadorRevelarCvv(peticion: SolicitudAutenticada, respuesta: Response) {
  const { otpCode } = esquemaRevelarCvv.parse(peticion.body);
  const resultado = await servicioCuenta.revelarCvv(peticion.user!.id, otpCode, obtenerMetaSolicitud(peticion));
  respuesta.json(resultado);
}
