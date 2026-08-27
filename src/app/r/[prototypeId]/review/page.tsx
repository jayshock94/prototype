import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getDb } from "@/db";
import {
  criterion,
  feedback,
  message,
  notBuilt,
  prototype,
  session,
  task,
  version,
} from "@/db/schema";
import {
  hasValidPass,
  passCookieName,
  readSessionId,
  sessionCookieName,
} from "@/lib/reviewer-auth";
import { isAssistantOff } from "@/lib/briefing";
import { hasAnthropicApiKey } from "@/lib/env";
import { AssistantPanel, type TimelineEntry } from "./assistant-panel";
import { FeedbackPanel } from "./feedback-panel";

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
      mode: prototype.mode,
      versionId: version.id,
      label: version.label,
      changedNote: version.changedNote,
      scenario: version.scenario,
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
    .select({
      reviewerName: session.reviewerName,
      completedAt: session.completedAt,
    })
    .from(session)
    .where(and(eq(session.id, sessionId), eq(session.versionId, row.versionId)))
    .limit(1);

  if (!visit) redirect(`/r/${prototypeId}`);

  /*
   * The briefing, for both panels but used differently. With no assistant the
   * reviewer reads it on screen, because there is nobody to ask what this
   * review is about. With one, only the counts matter here: the assistant
   * already has the detail in its prompt, and the panel just needs to know
   * whether to offer "what am I meant to try?" as a starter.
   */
  const assistantOff = isAssistantOff(row.mode);

  const [briefTasks, briefCriteria, briefNotBuilt] = await Promise.all([
    db
      .select({ goal: task.goal, successState: task.successState })
      .from(task)
      .where(eq(task.versionId, row.versionId))
      .orderBy(asc(task.sortOrder)),
    db
      .select({
        ref: criterion.ref,
        text: criterion.text,
        verifiableInPrototype: criterion.verifiableInPrototype,
      })
      .from(criterion)
      .where(eq(criterion.versionId, row.versionId))
      .orderBy(asc(criterion.sortOrder)),
    db
      .select({ text: notBuilt.text })
      .from(notBuilt)
      .where(eq(notBuilt.versionId, row.versionId))
      .orderBy(asc(notBuilt.sortOrder)),
  ]);

  // Reload the conversation so a reviewer who refreshes, or comes back to the
  // tab, does not find an empty panel and wonder if it was lost.
  const transcript = await db
    .select({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.sessionId, sessionId))
    .orderBy(asc(message.createdAt));

  const logged = await db
    .select({
      id: feedback.id,
      screenId: feedback.screenId,
      expected: feedback.expected,
      happened: feedback.happened,
      note: feedback.note,
      severity: feedback.severity,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.sessionId, sessionId))
    .orderBy(asc(feedback.createdAt));

  /*
   * Messages and feedback are stored in two tables but happened in one order,
   * so they are merged back into one timeline by timestamp. A reviewer who
   * refreshes sees what they said and what was captured from it in the same
   * sequence as when it happened, rather than a conversation with the receipts
   * swept into a pile at the end.
   *
   * An assistant message is written once the whole turn is done, so it lands
   * after the feedback rows that turn produced. That is why a reload reads
   * "you said this -> this was logged -> it replied", which is the honest
   * order even though live streaming shows the reply beginning first.
   */
  const timeline: TimelineEntry[] = [
    ...transcript.map((row) => ({
      kind: "message" as const,
      id: row.id,
      role: row.role,
      content: row.content,
      at: row.createdAt.getTime(),
    })),
    ...logged.map((row) => ({
      kind: "feedback" as const,
      id: row.id,
      item: {
        id: row.id,
        screenId: row.screenId,
        expected: row.expected,
        happened: row.happened,
        note: row.note,
        severity: row.severity,
      },
      at: row.createdAt.getTime(),
    })),
  ]
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...entry }) => entry);

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

        {assistantOff ? (
          <FeedbackPanel
            prototypeId={prototypeId}
            scenario={row.scenario}
            tasks={briefTasks}
            criteria={briefCriteria}
            notBuilt={briefNotBuilt.map((n) => n.text)}
            initialItems={logged.map((item) => ({
              id: item.id,
              screenId: item.screenId,
              expected: item.expected,
              happened: item.happened,
              note: item.note,
              severity: item.severity,
            }))}
            initiallyCompleted={visit.completedAt !== null}
          />
        ) : (
          <AssistantPanel
            prototypeId={prototypeId}
            initialTimeline={timeline}
            initiallyCompleted={visit.completedAt !== null}
            configured={hasAnthropicApiKey()}
            hasTasks={briefTasks.length > 0}
            hasCriteria={briefCriteria.length > 0}
          />
        )}
      </div>
    </div>
  );
}
