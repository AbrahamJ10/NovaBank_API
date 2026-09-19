import { z } from "zod";

export const payQrSchema = z.object({
  merchant: z.string().trim().min(1).max(80),
  amount: z.number().positive(),
});

export type PayQrInput = z.infer<typeof payQrSchema>;
