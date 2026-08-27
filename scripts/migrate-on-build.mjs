/**
 * Run pending database migrations as part of the build.
 *
 * Vercel builds and deploys the code; nothing was applying the SQL that goes
 * with it. That is fine right up until a deploy adds a column, at which point
 * every page that reads it dies with `column "x" does not exist` and the only
 * clue is in the runtime logs.
 *
 * This calls Drizzle's migrator directly rather than shelling out to
 * `drizzle-kit migrate`. The CLI prints a spinner and swallows the actual
 * error, so a failed deploy log ends on "applying migrations..." and tells you
 * nothing -- which is exactly what happened the first time this script existed.
 * The programmatic migrator throws a real error, and a real error is the whole
 * point of failing a build.
 *
 * Two things worth knowing:
 *
 *  - **A failed migration fails the build.** Deliberate. Deploying code that
 *    needs a column the database does not have is worse than not deploying,
 *    because the site looks up and is not.
 *  - **Preview deploys migrate the same database as production**, because they
 *    share DATABASE_URL. That is already true of everything else here: a
 *    preview reads and writes the real prototypes. It works because these
 *    migrations only ever add things with defaults, so code that predates a
 *    column is unaffected by it existing. If a migration ever needs to drop or
 *    rename something, do not let a preview run it -- give previews their own
 *    branch database first.
 *
 * With no DATABASE_URL this does nothing and exits cleanly, so `npm run build`
 * still works on a machine that has never been pointed at a database.
 */

import path from "node:path";
import process from "node:process";

const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.log("[migrate] DATABASE_URL is not set, skipping migrations.");
  process.exit(0);
}

console.log("[migrate] Applying any pending migrations...");

/** Everything after the credentials, so a log never carries the password. */
function safeTarget(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

try {
  const [{ default: postgres }, { drizzle }, { migrate }] = await Promise.all([
    import("postgres"),
    import("drizzle-orm/postgres-js"),
    import("drizzle-orm/postgres-js/migrator"),
  ]);

  // One connection, and no prepared statements: a migration run is a single
  // short-lived job, and pooled Postgres endpoints reject prepared statements.
  const sql = postgres(url, { max: 1, prepare: false });

  try {
    await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log(`[migrate] Up to date: ${safeTarget(url)}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
} catch (error) {
  console.error("");
  console.error(`[migrate] Migrations failed against ${safeTarget(url)}.`);
  console.error("[migrate] The build was stopped rather than deploying code that");
  console.error("[migrate] needs a column the database does not have.");
  console.error("");
  console.error(`[migrate] ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.cause) {
    console.error(`[migrate] cause: ${String(error.cause)}`);
  }
  console.error("");
  console.error("[migrate] Usually one of:");
  console.error("[migrate]   - DATABASE_URL is unreachable, or missing sslmode=require.");
  console.error("[migrate]   - the database is asleep. Neon suspends idle databases.");
  console.error("[migrate]   - a pooled connection string. Migrations want the direct one.");
  console.error("[migrate]   - two branches added a migration with the same number.");
  console.error("");
  process.exit(1);
}
