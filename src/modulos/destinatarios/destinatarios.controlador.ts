import { Response } from "express";
import { z } from "zod";
import type { SolicitudAutenticada } from "../../intermediarios/requerirAutenticacion";
import * as servicioBeneficiarios from "./destinatarios.servicio";

export async function manejadorListarBeneficiarios(peticion: SolicitudAutenticada, respuesta: Response) {
  const items = await servicioBeneficiarios.listarBeneficiarios(peticion.user!.id);
  respuesta.json({ items });
}

const esquemaCrearBeneficiario = z.object({
  name: z.string().trim().min(2).max(80),
  bank: z.string().trim().min(2).max(60),
  accountNumber: z.string().trim().min(4).max(30),
});

export async function manejadorCrearBeneficiario(peticion: SolicitudAutenticada, respuesta: Response) {
  const entrada = esquemaCrearBeneficiario.parse(peticion.body);
  const beneficiario = await servicioBeneficiarios.crearBeneficiario(peticion.user!.id, entrada);
  respuesta.status(201).json(beneficiario);
}
