// Neon serverless Postgres connection.
//
// Uses the Neon HTTP driver (fetch-based) which is the right fit for Vercel
// serverless functions — no TCP connection pooling to exhaust. The connection
// string comes from DATABASE_URL. When it is absent the app still runs; the
// saved-cases feature simply reports that persistence is not configured.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;
let _ensured = false;

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!_sql) _sql = neon(url);
  return _sql;
}

// Lazily create the saved_cases table on first use so the user only has to
// provide DATABASE_URL — no separate migration step required.
export async function ensureSchema(): Promise<void> {
  if (_ensured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS saved_cases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email text NOT NULL,
      name text NOT NULL,
      state jsonb NOT NULL,
      results jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_saved_cases_user_email ON saved_cases (user_email)`;
  _ensured = true;
}
