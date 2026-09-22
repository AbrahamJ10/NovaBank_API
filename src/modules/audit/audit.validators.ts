import { z } from "zod";

const eventSchema = z.object({
  action: z.string().trim().min(1).max(120),
  screen: z.string().trim().max(120).optional(),
  success: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Tamaño de lote limitado — la app vacía su cola local cada pocos segundos,
// así que una sola solicitud nunca debería necesitar más eventos que este.
export const recordEventsSchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
});
