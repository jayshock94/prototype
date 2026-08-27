/**
 * Run pending database migrations as part of the build.
 *
 * Vercel builds and deploys the code; nothing was applying the SQL that goes
 * with it. That is fine right up until a deploy adds a column, at which point
 * every page that reads it dies with `column "x" does not exist` and the only
 * clue is in the runtime logs. It cost an afternoon once. Now it cannot.
 *
 * Two things worth knowing:
 *
 *  - **A failed migration fails the build.** That is deliberate. Deploying code
 *    that needs a column the database does not have is worse than not
 *    deploying, because the site looks up and is not.
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

import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL?.trim()) {
  console.log("[migrate] DATABASE_URL is not set, skipping migrations.");
  process.exit(0);
}

console.log("[migrate] Applying any pending migrations...");

const result = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  // Windows resolves npx through the shell; harmless everywhere else.
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("[migrate] Could not run drizzle-kit:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  // drizzle-kit is quiet about connection failures -- it prints a spinner and
  // stops -- so say out loud what a failure here usually means. A build log
  // that ends on "applying migrations..." is otherwise a mystery.
  console.error(
    [
      "",
      "[migrate] Migrations failed, so the build was stopped before deploying.",
      "[migrate] Deploying code that needs a column the database does not have",
      "[migrate] would put up a site that looks fine and is not.",
      "",
      "[migrate] Usually one of:",
      "[migrate]   - DATABASE_URL points somewhere unreachable, or the password",
      "[migrate]     is wrong. A wrong host looks like a hang, then this.",
      "[migrate]   - the database is asleep. Neon suspends idle databases; open",
      "[migrate]     the dashboard once and redeploy.",
      "[migrate]   - two branches added a migration with the same number.",
      "",
    ].join("\n"),
  );
}

process.exit(result.status ?? 1);
