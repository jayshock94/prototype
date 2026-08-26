import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";

import { Button } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { AddIcon, ErrorIcon, InventoryIcon } from "@/components/m3/icons";
import { getDb } from "@/db";
import { prototype, version } from "@/db/schema";
import { hasDatabaseUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Prototypes · Admin" };

// Always read fresh. A cached list would keep showing a prototype you just
// deleted, or hide one you just uploaded.
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  ticket: string | null;
  createdAt: Date;
  currentVersionLabel: string | null;
};

/**
 * One query, left-joined to the current version, rather than fetching
 * prototypes and then looping to fetch each one's version. That loop is the
 * classic N+1 problem: fine with three prototypes, slow with three hundred.
 */
async function loadPrototypes(): Promise<Row[]> {
  const db = getDb();
  return db
    .select({
      id: prototype.id,
      name: prototype.name,
      ticket: prototype.ticket,
      createdAt: prototype.createdAt,
      currentVersionLabel: version.label,
    })
    .from(prototype)
    .leftJoin(
      version,
      // The partial unique index on version guarantees at most one current
      // version per prototype, so this join cannot duplicate rows.
      and(eq(version.prototypeId, prototype.id), eq(version.isCurrent, true)),
    )
    .orderBy(desc(prototype.createdAt));
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Shown when DATABASE_URL is missing or the database will not answer. */
function SetupNeeded({ detail }: { detail: string }) {
  return (
    <Card variant="outlined" className="border-error/40 p-6">
      <div className="flex gap-4">
        <span className="mt-0.5 shrink-0 text-error">
          <ErrorIcon />
        </span>
        <div className="min-w-0">
          <h2 className="text-title-medium text-on-surface">
            The database is not connected yet
          </h2>
          <p className="mt-2 text-body-medium text-on-surface-variant">
            Everything else is working -- you signed in fine. The app just cannot
            reach Postgres. README.md has the steps: create the database, put its
            connection string in <code className="text-body-medium">DATABASE_URL</code>,
            then run <code className="text-body-medium">npm run db:migrate</code>.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xs bg-surface-container p-3 text-body-small text-on-surface-variant">
            {detail}
          </pre>
        </div>
      </div>
    </Card>
  );
}

/** Shown when the database is fine and simply has nothing in it yet. */
function EmptyState() {
  return (
    <Card variant="filled" className="px-6 py-16">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant">
          <InventoryIcon />
        </span>
        <h2 className="text-title-large text-on-surface">No prototypes yet</h2>
        <p className="text-body-medium text-on-surface-variant">
          Upload an HTML prototype and the portal will give you a link to send
          reviewers. Uploading arrives in the next chunk of work.
        </p>
      </div>
    </Card>
  );
}

function PrototypeList({ rows }: { rows: Row[] }) {
  return (
    <Card variant="outlined" className="overflow-hidden p-0">
      <ul className="divide-y divide-outline-variant">
        {rows.map((row) => (
          <li
            key={row.id}
            className="m3-state-layer flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 text-on-surface"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-title-medium">{row.name}</p>
              <p className="truncate text-body-small text-on-surface-variant">
                {row.ticket ?? "No ticket"}
              </p>
            </div>
            <span className="rounded-full bg-secondary-container px-3 py-1 text-label-medium text-on-secondary-container">
              {row.currentVersionLabel ?? "No version"}
            </span>
            <span className="text-body-small text-on-surface-variant">
              {formatDate(row.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function AdminDashboard() {
  let rows: Row[] = [];
  let failure: string | null = null;

  if (!hasDatabaseUrl()) {
    failure = "DATABASE_URL is not set.";
  } else {
    try {
      rows = await loadPrototypes();
    } catch (error) {
      // A missing table means the migration has not been run, which is a
      // normal state on a fresh install and not worth crashing the page over.
      failure = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-medium text-on-surface">Prototypes</h1>
          <p className="mt-1 text-body-medium text-on-surface-variant">
            {failure
              ? "Waiting on the database."
              : rows.length === 1
                ? "1 prototype"
                : `${rows.length} prototypes`}
          </p>
        </div>

        {/* TODO chunk 2: point this at /admin/new once the upload form exists. */}
        <Button variant="filled" icon={<AddIcon className="size-[18px]" />} disabled>
          New prototype
        </Button>
      </div>

      {failure ? (
        <SetupNeeded detail={failure} />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <PrototypeList rows={rows} />
      )}
    </div>
  );
}
