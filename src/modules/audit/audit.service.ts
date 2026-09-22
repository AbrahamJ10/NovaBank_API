import { AuditCategory, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { RequestMeta } from "../../lib/requestMeta";

export interface RecordAuditInput {
  userId?: string | null;
  category: AuditCategory;
  action: string;
  success?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
  screen?: string;
  meta?: RequestMeta;
}

// Se llama desde dentro del servicio que ejecuta la acción (transferencias,
// pagos de recibo, retiros, eventos de sesión/login, cambios de
// perfil/seguridad, ...) justo después de que tenga éxito o falle — nunca
// bloquea ni hace fallar la operación de fondo: una escritura de auditoría
// rota no debe tumbar una solicitud real de movimiento de dinero, así que
// los errores aquí solo se registran en el log.
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        category: input.category,
        action: input.action,
        success: input.success ?? true,
        description: input.description,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        screen: input.screen,
        ip: input.meta?.ip,
        country: input.meta?.country,
        city: input.meta?.city,
        device: input.meta?.device,
        platform: input.meta?.platform,
        appVersion: input.meta?.appVersion,
      },
    });
  } catch (err) {
    console.error("Failed to record audit log", input.action, err);
  }
}

export interface ClientAuditEvent {
  action: string;
  screen?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

// Recibe un lote de eventos observados por el cliente (vistas de pantalla,
// toques de botón) — la única categoría de evento de auditoría que el
// servidor no puede ver por sí mismo. El validador de la ruta limita el
// tamaño del lote a algo razonable; cada fila igual recibe el mismo
// contexto de ip/dispositivo/geo que cualquier evento registrado por el
// servidor. createdAt siempre es la hora de recepción del servidor (nunca
// confía en una marca de tiempo que envíe el cliente) para que el rastro
// no pueda ser adulterado con fecha falsa por un cliente manipulado.
export async function recordClientEvents(userId: string, events: ClientAuditEvent[], meta: RequestMeta): Promise<void> {
  if (events.length === 0) return;

  const rows: Prisma.AuditLogCreateManyInput[] = events.map((e) => ({
    userId,
    category: AuditCategory.NAVEGACION,
    action: e.action,
    success: e.success ?? true,
    metadata: e.metadata as Prisma.InputJsonValue | undefined,
    screen: e.screen,
    ip: meta.ip,
    country: meta.country,
    city: meta.city,
    device: meta.device,
    platform: meta.platform,
    appVersion: meta.appVersion,
  }));

  await prisma.auditLog.createMany({ data: rows });
}
