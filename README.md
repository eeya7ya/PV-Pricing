# Solar PV Calculator

Professional Solar Photovoltaic (PV) system calculator with monthly energy
analysis, ROI / NPV calculations and scenario comparison. Originally a Replit
project — migrated to run on **Vercel** with a demo (fake) sign-in instead of
Google / Replit OAuth.

## Project layout

```
api/          Vercel serverless function (Express adapter)
client/       React + Vite frontend
server/       Express app (also used as Vite middleware in dev)
shared/       Shared TypeScript schemas (Zod + Drizzle types)
vercel.json   Vercel build & rewrite config
```

## Demo accounts

| Username   | Password       | Role  |
|------------|----------------|-------|
| `admin`    | `admin123`     | Admin |
| `user`     | `user123`      | User  |
| `engineer` | `engineer123`  | User  |

The auth screen also has three one-click demo buttons. Sessions are stored in
a signed HMAC cookie so the app is fully stateless — no database required.

## Local development

```bash
npm install
npm run dev          # http://localhost:5000
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in Vercel.
3. (Optional) Set `SESSION_SECRET` to a long random string under Project
   Settings → Environment Variables. Without it a default development
   secret is used.
4. Vercel runs `npm run build` (Vite → `dist/public`) and deploys
   `api/index.ts` as a Node serverless function.

`vercel.json` rewrites `/api/*` to the Express handler and everything else
to the SPA `index.html`.
