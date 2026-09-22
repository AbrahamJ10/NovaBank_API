import { Prisma } from "@prisma/client";
import { prisma } from "../../libreria/prisma";

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
export async function createNotification(db: Db, idUsuario: string, entrada: NotificationInput) {
  return db.notification.create({ data: { userId: idUsuario, ...entrada } });
}

export async function listarNotificaciones(idUsuario: string, limite = 50) {
  const elementos = await prisma.notification.findMany({
    where: { userId: idUsuario },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
  return elementos;
}

export async function marcarTodasLeidas(idUsuario: string) {
  await prisma.notification.updateMany({ where: { userId: idUsuario, unread: true }, data: { unread: false } });
}

export async function marcarLeida(idUsuario: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId: idUsuario }, data: { unread: false } });
}

export async function eliminarTodas(idUsuario: string) {
  await prisma.notification.deleteMany({ where: { userId: idUsuario } });
}
