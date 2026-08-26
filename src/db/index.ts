/**
 * The database connection.
 *
 * Uses postgres.js over a standard Postgres connection, which works with Neon,
 * Vercel Postgres, and a plain Postgres running on your laptop. Nothing here is
 * provider specific -- if you move databases, only DATABASE_URL changes.
 *
 * Two things worth knowing:
 *
 *  - The connection is cached on globalThis. In development Next.js reloads
 *    modules on every edit, and without this cache each reload would open new
 *    connections until the database refused more.
 *  - `max: 1` and `prepare: false` are for serverless. On Vercel each request
 *    may run in its own short-lived instance, so a large pool is wasted and
 *    prepared statements do not survive. Use your provider's *pooled*
 *    connection string.
 *
 * Call `getDb()` rather than importing a ready-made client. Building it lazily
 * means importing this file does not blow up when DATABASE_URL is unset, which
 * is what lets the admin dashboard show a friendly setup message instead of a
 * stack trace.
 */

import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseUrl } from "@/lib/env";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __prpSql?: ReturnType<typeof postgres>;
  __prpDb?: Db;
};

export function getDb(): Db {
  if (!globalForDb.__prpDb) {
    globalForDb.__prpSql ??= postgres(databaseUrl(), {
      max: 1,
      prepare: false,
    });
    globalForDb.__prpDb = drizzle(globalForDb.__prpSql, { schema });
  }
  return globalForDb.__prpDb;
}

export { schema };
export type { Db };
