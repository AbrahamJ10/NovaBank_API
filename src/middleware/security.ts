import { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { env } from "../config/env";

export function applySecurityMiddleware(app: Express): void {
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render sits behind a proxy; needed for correct req.ip

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    })
  );
  app.use(morgan(env.isProduction ? "combined" : "dev"));
}
