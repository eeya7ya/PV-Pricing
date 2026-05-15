// Vercel serverless entrypoint.
//
// All requests under /api/* are routed here by `vercel.json` and handled by
// the same Express app used for local development.

import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

let appPromise: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

async function getHandler() {
  if (!appPromise) {
    appPromise = createApp().then((app) => app as unknown as (req: IncomingMessage, res: ServerResponse) => void);
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getHandler();
  return app(req, res);
}
