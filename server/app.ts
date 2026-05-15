// Express app factory. Used by both the local dev server (server/index.ts)
// and the Vercel serverless entrypoint (api/index.ts).

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";

export async function createApp(): Promise<Express> {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Light request logger for /api routes.
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    res.on("finish", () => {
      if (path.startsWith("/api")) {
        const duration = Date.now() - start;
        console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  });

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) res.status(status).json({ message });
  });

  return app;
}
