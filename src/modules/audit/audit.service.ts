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
export async function recordAudit(entrada: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entrada.userId ?? null,
        category: entrada.category,
        action: entrada.action,
        success: entrada.success ?? true,
        description: entrada.description,
        metadata: entrada.metadata as Prisma.InputJsonValue | undefined,
        screen: entrada.screen,
        ip: entrada.meta?.ip,
        country: entrada.meta?.country,
        city: entrada.meta?.city,
        device: entrada.meta?.device,
        platform: entrada.meta?.platform,
        appVersion: entrada.meta?.appVersion,
      },
    });
  } catch (error) {
    console.error("No se pudo registrar la auditoría", entrada.action, error);
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
export async function recordClientEvents(idUsuario: string, eventos: ClientAuditEvent[], metaSolicitud: RequestMeta): Promise<void> {
  if (eventos.length === 0) return;

  const filas: Prisma.AuditLogCreateManyInput[] = eventos.map((e) => ({
    userId: idUsuario,
    category: AuditCategory.NAVEGACION,
    action: e.action,
    success: e.success ?? true,
    metadata: e.metadata as Prisma.InputJsonValue | undefined,
    screen: e.screen,
    ip: metaSolicitud.ip,
    country: metaSolicitud.country,
    city: metaSolicitud.city,
    device: metaSolicitud.device,
    platform: metaSolicitud.platform,
    appVersion: metaSolicitud.appVersion,
  }));

  await prisma.auditLog.createMany({ data: filas });
}
