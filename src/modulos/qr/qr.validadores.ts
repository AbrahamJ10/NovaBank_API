import { z } from "zod";

export const esquemaPagoQr = z.object({
  merchant: z.string().trim().min(1).max(80),
  amount: z.number().positive(),
});

export type EntradaPagoQr = z.infer<typeof esquemaPagoQr>;
