import { z } from "zod";

export const updateAlertsSchema = z.object({
  compra: z.boolean(),
  retiro: z.boolean(),
  login: z.boolean(),
  promo: z.boolean(),
});

export const updateLimitsSchema = z.object({
  limitOnline: z.number().min(0).max(100000),
  limitAtm: z.number().min(0).max(100000),
  geoPeru: z.boolean(),
  geoIntl: z.boolean(),
});

export const sessionTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export const revokeSessionParamsSchema = z.object({ id: z.string().uuid() });

export type UpdateAlertsInput = z.infer<typeof updateAlertsSchema>;
export type UpdateLimitsInput = z.infer<typeof updateLimitsSchema>;
