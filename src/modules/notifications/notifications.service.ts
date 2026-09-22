import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type Db = typeof prisma | Prisma.TransactionClient;

export type NotificationInput = {
  title: string;
  body: string;
  icon: string;
  iconBg: string;
  iconFg: string;
};

// Se llama desde donde sea que pase algo digno de notificar (llega una
// transacción real, se dispara un evento de seguridad) — recibe un cliente
// db/tx para poder crearse de forma atómica junto con lo que la haya
// disparado.
export async function createNotification(db: Db, userId: string, input: NotificationInput) {
  return db.notification.create({ data: { userId, ...input } });
}

export async function listNotifications(userId: string, limit = 50) {
  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return items;
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, unread: true }, data: { unread: false } });
}

export async function markRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { unread: false } });
}

export async function deleteAll(userId: string) {
  await prisma.notification.deleteMany({ where: { userId } });
}
