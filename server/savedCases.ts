// Per-user saved study cases, backed by Neon Postgres.
//
// Each row belongs to a user identified by their email (their Google account).
// The full calculator input state and the last computed results are stored as
// JSONB so a case can be restored exactly. All queries are scoped by
// user_email so users only ever see their own cases.

import { getSql, ensureSchema } from "./db";

export interface SavedCaseSummary {
  id: string;
  name: string;
  customer_type: string | null;
  grid_connection: string | null;
  has_results: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedCaseFull extends SavedCaseSummary {
  user_email: string;
  state: unknown;
  results: unknown;
}

export async function listCases(email: string): Promise<SavedCaseSummary[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      name,
      state->>'customerType'  AS customer_type,
      state->>'gridConnection' AS grid_connection,
      (results IS NOT NULL)    AS has_results,
      created_at,
      updated_at
    FROM saved_cases
    WHERE user_email = ${email}
    ORDER BY updated_at DESC
  `;
  return rows as SavedCaseSummary[];
}

export async function getCase(id: string, email: string): Promise<SavedCaseFull | undefined> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM saved_cases WHERE id = ${id} AND user_email = ${email} LIMIT 1
  `;
  return rows[0] as SavedCaseFull | undefined;
}

export async function createCase(
  email: string,
  name: string,
  state: unknown,
  results: unknown,
): Promise<SavedCaseFull> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO saved_cases (user_email, name, state, results)
    VALUES (
      ${email},
      ${name},
      ${JSON.stringify(state)}::jsonb,
      ${results == null ? null : JSON.stringify(results)}::jsonb
    )
    RETURNING *
  `;
  return rows[0] as SavedCaseFull;
}

export async function updateCase(
  id: string,
  email: string,
  name: string,
  state: unknown,
  results: unknown,
): Promise<SavedCaseFull | undefined> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    UPDATE saved_cases
    SET name = ${name},
        state = ${JSON.stringify(state)}::jsonb,
        results = ${results == null ? null : JSON.stringify(results)}::jsonb,
        updated_at = now()
    WHERE id = ${id} AND user_email = ${email}
    RETURNING *
  `;
  return rows[0] as SavedCaseFull | undefined;
}

export async function deleteCase(id: string, email: string): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM saved_cases WHERE id = ${id} AND user_email = ${email} RETURNING id
  `;
  return rows.length > 0;
}
