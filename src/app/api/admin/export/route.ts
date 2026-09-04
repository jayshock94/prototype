/**
 * The designer's copy of the feedback.
 *
 * Two shapes, from one route:
 *
 *  - `?prototypeId=…` — everything. Every finding from every reviewer across
 *    every version, pooled into one document, with the conversations at the
 *    back and the screenshots in a folder.
 *  - `?prototypeId=…&sessionId=…` — one review, which is byte for byte the
 *    file that reviewer could have downloaded themselves. That is the one to
 *    forward to a developer: it is one person's account of one session and
 *    reads as such.
 *
 * `&format=md` returns just the Markdown, as text, for the copy button.
 *
 * SECURITY: middleware only guards /admin, not /api, so this route checks the
 * admin session itself -- exactly like /api/prototype-upload. Without that
 * check, `prototypeId` is a UUID away from being every reviewer's feedback and
 * every screenshot, with no password anywhere.
 */

import { asc, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { annotation, feedback, message, prototype, session, version } from "@/db/schema";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  buildReportHtml,
  buildReportMarkdown,
  buildSummaryHtml,
  buildSummaryMarkdown,
  collectShots,
  exportFileName,
  summaryFileName,
  type ExportData,
  type ExportMessage,
  type ExportShot,
  type SummaryData,
  type SummaryItem,
  type SummaryReview,
} from "@/lib/export-report";
import { getAnnotationImage } from "@/lib/prototype-storage";
import { ROLE_LABELS } from "@/lib/reviewer-role";
import { createZip, type ZipEntry } from "@/lib/zip";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const store = await cookies();
  if (!(await verifySessionToken(store.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const prototypeId = url.searchParams.get("prototypeId") ?? "";
  const sessionId = url.searchParams.get("sessionId");
  const markdownOnly = url.searchParams.get("format") === "md";

  if (!UUID.test(prototypeId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (sessionId !== null && !UUID.test(sessionId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const db = getDb();

  const [context] = await db
    .select({
      name: prototype.name,
      ticket: prototype.ticket,
      description: prototype.description,
    })
    .from(prototype)
    .where(eq(prototype.id, prototypeId))
    .limit(1);

  if (!context) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const now = new Date();

  return sessionId
    ? oneReview({ db, prototypeId, sessionId, markdownOnly, now })
    : wholePrototype({ db, prototypeId, context, markdownOnly, now });
}

type Db = ReturnType<typeof getDb>;

/* --------------------------------------------------------------------------
 * One review
 *
 * Produced with the reviewer's own builders rather than a second admin-shaped
 * version of the same document. A review is one person's account of one
 * session; nothing about reading it as the designer changes what it should say.
 * ------------------------------------------------------------------------ */
async function oneReview({
  db,
  prototypeId,
  sessionId,
  markdownOnly,
  now,
}: {
  db: Db;
  prototypeId: string;
  sessionId: string;
  markdownOnly: boolean;
  now: Date;
}) {
  // The join to prototype is the check: a session id from somewhere else
  // matches nothing here, so the prototype in the URL is the one being read.
  const [context] = await db
    .select({
      prototypeName: prototype.name,
      ticket: prototype.ticket,
      versionLabel: version.label,
      changedNote: version.changedNote,
      reviewerName: session.reviewerName,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    })
    .from(session)
    .innerJoin(version, eq(version.id, session.versionId))
    .innerJoin(prototype, eq(prototype.id, version.prototypeId))
    .where(eq(session.id, sessionId))
    .limit(1);

  if (!context) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const rows = await findingRows(db, { sessionId });
  const transcript = await db
    .select({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.sessionId, sessionId))
    .orderBy(asc(message.createdAt));

  const shots = await collectShots(rows, {
    withBytes: !markdownOnly,
    read: getAnnotationImage,
  });

  const data: ExportData = {
    ...context,
    items: rows.map((row) => ({
      id: row.id,
      screenId: row.screenId,
      expected: row.expected,
      happened: row.happened,
      note: row.note,
      severity: row.severity,
      createdAt: row.createdAt,
      shot: shots.get(row.id) ?? null,
    })),
    transcript,
  };

  if (markdownOnly) return asText(buildReportMarkdown(data, now));

  return asZip(
    [
      { name: "feedback.html", data: buildReportHtml(data, now) },
      { name: "feedback.md", data: buildReportMarkdown(data, now, { archive: true }) },
      ...shotEntries(shots),
    ],
    exportFileName(data, now),
    now,
  );
}

/* --------------------------------------------------------------------------
 * Everything
 * ------------------------------------------------------------------------ */
async function wholePrototype({
  db,
  prototypeId,
  context,
  markdownOnly,
  now,
}: {
  db: Db;
  prototypeId: string;
  context: { name: string; ticket: string | null; description: string | null };
  markdownOnly: boolean;
  now: Date;
}) {
  /*
   * Versions newest first, and findings within a version worst first. The same
   * two orders the admin feedback page uses, for the same reason: the current
   * version is what is actionable, and reading down a version is triage.
   */
  const rows = await findingRows(db, { prototypeId });

  const sessions = await db
    .select({
      id: session.id,
      reviewerName: session.reviewerName,
      reviewerRole: session.reviewerRole,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      versionLabel: version.label,
      versionCreatedAt: version.createdAt,
    })
    .from(session)
    .innerJoin(version, eq(version.id, session.versionId))
    .where(eq(version.prototypeId, prototypeId))
    .orderBy(desc(version.createdAt), asc(session.startedAt));

  const transcript = await db
    .select({
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })
    .from(message)
    .innerJoin(session, eq(session.id, message.sessionId))
    .innerJoin(version, eq(version.id, session.versionId))
    .where(eq(version.prototypeId, prototypeId))
    .orderBy(asc(message.createdAt));

  const bySession = new Map<string, ExportMessage[]>();
  for (const turn of transcript) {
    const list = bySession.get(turn.sessionId);
    const entry = { role: turn.role, content: turn.content, createdAt: turn.createdAt };
    if (list) list.push(entry);
    else bySession.set(turn.sessionId, [entry]);
  }

  const shots = await collectShots(rows, {
    withBytes: !markdownOnly,
    read: getAnnotationImage,
  });

  const items: SummaryItem[] = rows.map((row) => ({
    id: row.id,
    screenId: row.screenId,
    expected: row.expected,
    happened: row.happened,
    note: row.note,
    severity: row.severity,
    createdAt: row.createdAt,
    shot: shots.get(row.id) ?? null,
    reviewerName: row.reviewerName,
    versionLabel: row.versionLabel,
    disposition: row.disposition,
  }));

  const reviews: SummaryReview[] = sessions.map((row) => ({
    reviewerName: row.reviewerName,
    role: ROLE_LABELS[row.reviewerRole],
    versionLabel: row.versionLabel,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    transcript: bySession.get(row.id) ?? [],
    findings: items.filter((item) => item.reviewerName === row.reviewerName).length,
  }));

  const data: SummaryData = {
    prototypeName: context.name,
    ticket: context.ticket,
    description: context.description,
    reviews,
    items,
  };

  if (markdownOnly) return asText(buildSummaryMarkdown(data, now));

  return asZip(
    [
      { name: "all-feedback.html", data: buildSummaryHtml(data, now) },
      {
        name: "all-feedback.md",
        data: buildSummaryMarkdown(data, now, { archive: true }),
      },
      ...shotEntries(shots),
    ],
    summaryFileName(data, now),
    now,
  );
}

/* --------------------------------------------------------------------------
 * Shared bits
 * ------------------------------------------------------------------------ */

/**
 * Feedback rows with everything an export needs, for one session or a whole
 * prototype.
 *
 * One function because the two callers want identical columns and differ only
 * in the WHERE, and two nearly-identical forty-line selects is how a column
 * gets added to one and forgotten in the other.
 */
function findingRows(
  db: Db,
  scope: { sessionId: string } | { prototypeId: string },
) {
  const query = db
    .select({
      id: feedback.id,
      screenId: feedback.screenId,
      expected: feedback.expected,
      happened: feedback.happened,
      note: feedback.note,
      severity: feedback.severity,
      disposition: feedback.disposition,
      createdAt: feedback.createdAt,
      reviewerName: session.reviewerName,
      versionLabel: version.label,
      annotationLabel: annotation.label,
      annotationScreenId: annotation.screenId,
      annotationBlobUrl: annotation.screenshotBlobUrl,
    })
    .from(feedback)
    .innerJoin(session, eq(session.id, feedback.sessionId))
    .innerJoin(version, eq(version.id, session.versionId))
    .leftJoin(annotation, eq(annotation.id, feedback.annotationId));

  return "sessionId" in scope
    ? query
        .where(eq(feedback.sessionId, scope.sessionId))
        .orderBy(asc(feedback.createdAt))
    : query
        .where(eq(version.prototypeId, scope.prototypeId))
        .orderBy(desc(version.createdAt), asc(feedback.createdAt));
}

/** The screenshots that were actually fetched, as files for the archive. */
function shotEntries(shots: Map<string, ExportShot>): ZipEntry[] {
  return [...shots.values()].flatMap((shot) =>
    shot.bytes ? [{ name: shot.path, data: shot.bytes }] : [],
  );
}

function asText(markdown: string) {
  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function asZip(entries: ZipEntry[], filename: string, now: Date) {
  const archive = createZip(entries, now);

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      // Every name this produces is ASCII by construction -- see `slug` in
      // export-report.ts -- so the quoted form is enough.
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(archive.length),
      "Cache-Control": "no-store",
    },
  });
}
