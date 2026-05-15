// Local development entrypoint. On Vercel the entrypoint is `api/index.ts`,
// which imports the same Express app factory.

import http from "http";
import { createApp } from "./app";
import { setupVite, serveStatic, log } from "./vite";

(async () => {
  const app = await createApp();
  const server = http.createServer(app);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
