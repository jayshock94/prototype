import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getDb } from "@/db";
import { prototype, session, version } from "@/db/schema";
import {
  hasValidPass,
  passCookieName,
  readSessionId,
  sessionCookieName,
} from "@/lib/reviewer-auth";
import { AssistantPanel } from "./assistant-panel";

export const metadata: Metadata = {
  title: "Review",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The review page: the prototype, and the space the assistant will occupy.
 *
 * Reachable only with both cookies -- the pass proving the password was
 * entered, and a session saying which visit this is. Anyone without them is
 * sent back to /r/[prototypeId] to start again.
 *
 * The iframe points at /p/[versionId], never at Blob. That is the same-origin
 * rule from CLAUDE.md: chunks 6 to 8 need the page around the iframe to read
 * and change what is inside it, and browsers only allow that when both come
 * from the same domain.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ prototypeId: string }>;
}) {
  const { prototypeId } = await params;
  if (!UUID.test(prototypeId)) notFound();

  const store = await cookies();

  const passed = await hasValidPass(
    store.get(passCookieName(prototypeId))?.value,
    prototypeId,
  );
  if (!passed) redirect(`/r/${prototypeId}`);

  const sessionId = await readSessionId(
    store.get(sessionCookieName(prototypeId))?.value,
    prototypeId,
  );
  if (!sessionId) redirect(`/r/${prototypeId}`);

  const db = getDb();

  const [row] = await db
    .select({
      name: prototype.name,
      ticket: prototype.ticket,
      versionId: version.id,
      label: version.label,
      changedNote: version.changedNote,
    })
    .from(prototype)
    .innerJoin(
      version,
      and(eq(version.prototypeId, prototype.id), eq(version.isCurrent, true)),
    )
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  if (!row) notFound();

  // A cookie could name a session that has since been deleted, or one from a
  // different prototype's row. Confirm it really belongs to this version
  // before showing anything.
  const [visit] = await db
    .select({ reviewerName: session.reviewerName })
    .from(session)
    .where(and(eq(session.id, sessionId), eq(session.versionId, row.versionId)))
    .limit(1);

  if (!visit) redirect(`/r/${prototypeId}`);

  return (
    <div className="flex h-dvh flex-col bg-surface-container-lowest">
      <header className="flex shrink-0 items-center gap-3 border-b border-outline-variant bg-surface-container px-4 py-2 text-on-surface sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="truncate text-title-medium">{row.name}</h1>
            <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-small text-on-secondary-container">
              {row.label}
            </span>
            {row.ticket ? (
              <span className="text-body-small text-on-surface-variant">
                {row.ticket}
              </span>
            ) : null}
          </div>
          {row.changedNote ? (
            <p className="truncate text-body-small text-on-surface-variant">
              {row.changedNote}
            </p>
          ) : null}
        </div>

        <span className="shrink-0 rounded-full bg-surface-container-highest px-3 py-1 text-label-medium text-on-surface-variant">
          {visit.reviewerName}
        </span>
      </header>

      {/*
        Side by side on desktop, stacked on anything narrower. The prototype
        keeps a workable height on mobile rather than being squeezed by the
        panel below it.
      */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 max-lg:h-[65dvh]">
          <iframe
            src={`/p/${row.versionId}`}
            title={`${row.name} ${row.label}`}
            className="h-full w-full border-0 bg-white"
          />
        </div>

        <AssistantPanel />
      </div>
    </div>
  );
}
