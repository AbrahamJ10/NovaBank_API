import { z } from "zod";

const eventSchema = z.object({
  action: z.string().trim().min(1).max(120),
  screen: z.string().trim().max(120).optional(),
  success: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Capped batch size — the app flushes its local queue every few seconds, so
// a single request should never need more than this many events.
export const recordEventsSchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
});
