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

// Called from inside the service that performs the action (transfers,
// bill payments, withdrawals, session/login events, profile/security
// changes, ...) right after it succeeds or fails — never blocks or fails
// the underlying operation: a broken audit write shouldn't take down a
// real money-moving request, so errors here are only logged.
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

// Ingests a batch of client-observed events (screen views, button taps) —
// the only category of audit event the server can't see for itself. Capped
// at a sane batch size by the route validator; each row still gets the
// same ip/device/geo context as any server-recorded event. createdAt is
// always the server's receive time (never trusts a client-supplied
// timestamp) so the trail can't be backdated by a tampered client.
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
