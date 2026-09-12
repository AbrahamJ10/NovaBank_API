# NovaBank API

Backend de NovaBank: Express + TypeScript + Prisma, sobre PostgreSQL (Neon).
Pensado para desplegarse en Render y servir a la app móvil (`APP/`).

## Desarrollo local

```bash
cd API
npm install
npx prisma migrate dev --name init   # crea las tablas en la base de datos
npm run dev                          # http://localhost:3000
```

Copia `.env.example` a `.env` y completa los valores (ya existe un `.env` local
con las credenciales de desarrollo — **no se sube a git**, está en `.gitignore`).

## Endpoints implementados

| Método | Ruta               | Descripción                              | Auth |
|--------|--------------------|-------------------------------------------|------|
| GET    | `/health`          | Liveness check                            | No   |
| GET    | `/health/db`        | Verifica conexión a la base de datos      | No   |
| POST   | `/api/auth/register`| Crea una cuenta                          | No   |
| POST   | `/api/auth/login`   | Login, devuelve access + refresh token   | No   |
| POST   | `/api/auth/refresh` | Rota el refresh token, emite nuevo access | No   |
| POST   | `/api/auth/logout`  | Revoca el refresh token                   | No   |
| GET    | `/api/auth/me`      | Datos del usuario autenticado             | Sí (Bearer access token) |

## Seguridad implementada

- Contraseñas con `bcrypt` (12 salt rounds), nunca en texto plano.
- Access token JWT de vida corta (15 min) + refresh token opaco de larga
  duración (30 días), almacenado solo como hash SHA-256 en la base de datos.
- Rotación de refresh token en cada `/refresh`, con detección de reúso: si un
  token ya revocado se reintenta, se revocan todas las sesiones del usuario.
- Bloqueo de cuenta tras 5 intentos fallidos (15 minutos), registrado en
  `login_events` para auditoría.
- Rate limiting: límite general por IP y uno más estricto en `/api/auth/*`.
- `helmet`, payload limitado a 100kb, CORS restringido por `CORS_ORIGIN`.
- Mensajes de error genéricos en login para no revelar si un correo existe
  (mitiga enumeración de usuarios).

Fuera de alcance de este backend (requieren infraestructura, no código de
aplicación): protección DDoS volumétrica, BGP/DNS hijacking, jamming de RF,
SIM swapping. Eso se cubre con Render/Cloudflare y políticas del operador
móvil, no aquí.

## Desplegar en Render

1. Sube esta carpeta (`API/`) como su propio repositorio Git (Render despliega
   desde un repo).
2. En Render: **New > Web Service**, conecta el repo.
3. Render puede leer `render.yaml` automáticamente (Blueprint), o configura a
   mano:
   - **Build command**: `npm install && npm run build && npx prisma migrate deploy`
   - **Start command**: `npm start`
   - **Variables de entorno**: `DATABASE_URL` (tu connection string de Neon),
     `CORS_ORIGIN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (puedes dejar que
     Render los genere), `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`.
4. Una vez desplegado, la app móvil debe apuntar `EXPO_PUBLIC_API_URL` a la URL
   pública que te da Render (algo como `https://novabank-api.onrender.com`).

**Importante**: la contraseña de la base de datos de Neon usada durante esta
sesión se compartió en texto plano en el chat. Se recomienda rotarla desde el
panel de Neon una vez termines de configurar todo, y usar siempre variables de
entorno (nunca commitear `.env`).
