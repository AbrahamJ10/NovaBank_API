import { z } from "zod";

export const esquemaActualizarAlertas = z.object({
  compra: z.boolean(),
  retiro: z.boolean(),
  login: z.boolean(),
  promo: z.boolean(),
});

export const esquemaActualizarLimites = z.object({
  limitOnline: z.number().min(0).max(100000),
  limitAtm: z.number().min(0).max(100000),
  geoPeru: z.boolean(),
  geoIntl: z.boolean(),
});

export const esquemaTokenSesion = z.object({
  refreshToken: z.string().min(10),
});

export const esquemaParametrosRevocarSesion = z.object({ id: z.string().uuid() });

export type EntradaActualizarAlertas = z.infer<typeof esquemaActualizarAlertas>;
export type EntradaActualizarLimites = z.infer<typeof esquemaActualizarLimites>;
