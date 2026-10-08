import { Response, NextFunction } from "express";
import { prisma } from "../libreria/prisma";
import type { SolicitudAutenticada } from "./requerirAutenticacion";

// Va después de requerirAutenticacion — ese ya validó el JWT, este confirma
// con una lectura fresca a BD que ese usuario sigue siendo ADMIN. Se
// consulta la BD en vez de confiar en un campo "role" embebido en el JWT
// para que revocar el rol de un admin surta efecto de inmediato, sin
// esperar a que expire su access token (15 min).
export async function requerirAdmin(peticion: SolicitudAutenticada, respuesta: Response, siguiente: NextFunction): Promise<void> {
  if (!peticion.user) {
    respuesta.status(401).json({ error: "No autenticado" });
    return;
  }

  const usuario = await prisma.user.findUnique({ where: { id: peticion.user.id }, select: { role: true, isActive: true, deletedAt: true } });
  if (!usuario || usuario.role !== "ADMIN" || !usuario.isActive || usuario.deletedAt) {
    respuesta.status(403).json({ error: "No tienes permisos de administrador" });
    return;
  }

  siguiente();
}
