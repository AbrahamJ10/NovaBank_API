import { z } from "zod";

export const affiliateSchema = z.object({
  billerKey: z.string().min(1),
  supplyNumber: z.string().trim().min(3).max(30),
});

export type AffiliateInput = z.infer<typeof affiliateSchema>;
