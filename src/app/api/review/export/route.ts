/**
 * The reviewer's copy of their own review, as a downloadable archive.
 *
 * This is how feedback actually leaves the building. The reviewer presses
 * finish, downloads one file, and sends it however they already send things --
 * email, Teams, attached to a ticket. Nothing here assumes they will use any
 * particular one of those.
 *
 * Two files in the archive because there are two ways it gets sent. The HTML
 * is for attaching, and prints to PDF from any browser. The Markdown is for
 * pasting into a ticket or a chat window without reformatting it.
 *
 * A GET rather than a POST, so the browser's own download machinery does the
 * work: an ordinary link, a real filename from Content-Disposition, and a
 * progress indicator we did not have to build. Nothing here mutates anything.
 */

import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { feedback, message, prototype, session, version } from "@/db/schema";
import {
  buildReportHtml,
  buildReportMarkdown,
  exportFileName,
  type ExportData,
} from "@/lib/export-report";
import { currentReviewerSession } from "@/lib/reviewer-session";
import { createZip } from "@/lib/zip";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const prototypeId = url.searchParams.get("prototypeId") ?? "";
  if (!UUID.test(prototypeId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // `?format=md` returns just the Markdown, as text, for the copy-to-clipboard
  // button. Same data, same permission check -- it only skips the archive,
  // because you cannot paste a zip into a Teams message.
  const markdownOnly = url.searchParams.get("format") === "md";

  // The same check every reviewer route makes: this browser holds a valid pass
  // and a session that belongs to this prototype. An export is a copy of one
  // session and nothing else, so scoping it to the cookie is the whole of the
  // access control.
  const reviewer = await currentReviewerSession(prototypeId);
  if (!reviewer) {
    return NextResponse.json({ error: "No review session." }, { status: 401 });
  }

  const db = getDb();

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
    .where(eq(session.id, reviewer.sessionId))
    .limit(1);

  if (!context) {
    return NextResponse.json({ error: "No review session." }, { status: 401 });
  }

  const items = await db
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
    .where(eq(feedback.sessionId, reviewer.sessionId))
    .orderBy(asc(feedback.createdAt));

  const transcript = await db
    .select({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.sessionId, reviewer.sessionId))
    .orderBy(asc(message.createdAt));

  const now = new Date();
  const data: ExportData = { ...context, items, transcript };

  if (markdownOnly) {
    return new NextResponse(buildReportMarkdown(data, now), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const archive = createZip(
    [
      { name: "feedback.html", data: buildReportHtml(data, now) },
      { name: "feedback.md", data: buildReportMarkdown(data, now) },
    ],
    now,
  );

  const filename = exportFileName(data, now);

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      // The quoted filename is what the browser saves it as. Every name this
      // produces is ASCII by construction (see `slug`), so there is no need
      // for the filename* encoding dance.
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(archive.length),
      "Cache-Control": "no-store",
    },
  });
}
