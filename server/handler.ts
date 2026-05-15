// Source entrypoint for the Vercel serverless function.
// Bundled by esbuild during `npm run build` into `api/handler.mjs`.

import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "./app";

let appPromise: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

async function getHandler() {
  if (!appPromise) {
    appPromise = createApp().then(
      (app) => app as unknown as (req: IncomingMessage, res: ServerResponse) => void,
    );
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getHandler();
  return app(req, res);
}
