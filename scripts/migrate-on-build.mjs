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

import crypto from "node:crypto";
import fs from "node:fs";
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
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  try {
    await baselineIfPushed(sql, migrationsFolder);
    await migrate(drizzle(sql), { migrationsFolder });
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

/**
 * Adopt a database that was built with `db:push` rather than by migrating.
 *
 * `drizzle-kit push` writes the schema straight into the database and records
 * nothing, which is the fast way to get started and exactly what this project
 * did. The bill arrives the first time a migration runs: Drizzle sees an empty
 * history, tries to apply 0000 from the top, and dies on `type "..." already
 * exists`.
 *
 * So: if the history is empty *and* the first migration's tables are already
 * there, that migration provably does not need to run -- something else
 * created those tables. Record it as applied and let the rest follow. The
 * condition is deliberately narrow; on a genuinely empty database nothing
 * happens here and 0000 runs normally.
 *
 * A row is (hash, created_at), where the hash is a sha256 of the migration
 * file and created_at is its `when` from the journal. Drizzle compares
 * created_at to decide what is outstanding, so getting that number right is
 * what makes the next migration run.
 */
async function baselineIfPushed(sql, migrationsFolder) {
  const [{ exists: tracked }] = await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    ) as exists
  `;

  if (tracked) {
    const [{ count }] = await sql`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `;
    if (count > 0) return;
  }

  const [{ exists: hasSchema }] = await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'prototype'
    ) as exists
  `;

  // Nothing to adopt: a fresh database migrates from the top as usual.
  if (!hasSchema) return;

  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  );
  const first = journal.entries?.[0];
  if (!first) return;

  const body = fs.readFileSync(path.join(migrationsFolder, `${first.tag}.sql`), "utf8");
  const hash = crypto.createHash("sha256").update(body).digest("hex");

  await sql`create schema if not exists drizzle`;
  await sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `;
  await sql`
    insert into drizzle.__drizzle_migrations ("hash", "created_at")
    values (${hash}, ${first.when})
  `;

  console.log(
    `[migrate] This database was created with db:push, so ${first.tag} was recorded as already applied rather than run again.`,
  );
}
