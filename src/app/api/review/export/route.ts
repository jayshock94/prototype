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
import { annotation, feedback, message, prototype, session, version } from "@/db/schema";
import {
  buildReportHtml,
  buildReportMarkdown,
  exportFileName,
  slug,
  type ExportData,
  type ExportItem,
  type ExportShot,
} from "@/lib/export-report";
import { getAnnotationImage } from "@/lib/prototype-storage";
import { currentReviewerSession } from "@/lib/reviewer-session";
import { createZip } from "@/lib/zip";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many screenshots one export will carry. Past this, the words remain. */
const MAX_SHOTS = 60;

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

  const rows = await db
    .select({
      id: feedback.id,
      screenId: feedback.screenId,
      expected: feedback.expected,
      happened: feedback.happened,
      note: feedback.note,
      severity: feedback.severity,
      createdAt: feedback.createdAt,
      annotationLabel: annotation.label,
      annotationScreenId: annotation.screenId,
      annotationBlobUrl: annotation.screenshotBlobUrl,
    })
    .from(feedback)
    .leftJoin(annotation, eq(annotation.id, feedback.annotationId))
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

  /*
   * The pictures.
   *
   * The bytes are fetched only for the archive: the copy-as-text button wants
   * text, and downloading a dozen PNGs to produce a string nobody will see
   * them in is work for nothing. It still learns that the pictures exist, so
   * the pasted version can say so. A blob that has gone missing is skipped
   * rather than failing the export -- a report one picture short is still the
   * report, and a reviewer pressing download does not want to hear about our
   * storage.
   */
  const shots = await collectShots(rows, { withBytes: !markdownOnly });

  const items: ExportItem[] = rows.map((row) => ({
    id: row.id,
    screenId: row.screenId,
    expected: row.expected,
    happened: row.happened,
    note: row.note,
    severity: row.severity,
    createdAt: row.createdAt,
    shot: shots.get(row.id) ?? null,
  }));

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
      {
        name: "feedback.md",
        data: buildReportMarkdown(data, now, { archive: true }),
      },
      // The same pictures the HTML already carries inline, as real files. One
      // is for reading the report, the other is for dragging into a ticket.
      ...[...shots.values()].flatMap((shot) =>
        shot.bytes ? [{ name: shot.path, data: shot.bytes }] : [],
      ),
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

/**
 * Read every screenshot this session produced, keyed by the item it belongs to.
 *
 * Numbered in the order the items were logged, so the filenames sort the way
 * the report reads. The name carries the element label as well as the number
 * because `screenshots/03-continue-button.png` is a file somebody can find
 * again a week later and `03.png` is not.
 */
async function collectShots(
  rows: Array<{
    id: string;
    screenId: string | null;
    annotationLabel: string | null;
    annotationScreenId: string | null;
    annotationBlobUrl: string | null;
  }>,
  { withBytes }: { withBytes: boolean },
): Promise<Map<string, ExportShot>> {
  const wanted = rows.filter((row) => row.annotationBlobUrl).slice(0, MAX_SHOTS);

  const fetched = await Promise.all(
    wanted.map(async (row, index) => {
      const bytes = withBytes
        ? await getAnnotationImage(row.annotationBlobUrl!)
        : null;
      // Only a fetch that was attempted and failed counts as missing. A report
      // that was never going to carry the picture still says it exists.
      if (withBytes && !bytes) return null;

      const where = row.annotationScreenId ?? row.screenId;
      const label = [row.annotationLabel ?? "the area they pointed at", where]
        .filter(Boolean)
        .join(" — ");

      return [
        row.id,
        {
          path: `screenshots/${String(index + 1).padStart(2, "0")}-${slug(
            row.annotationLabel ?? where ?? "reference",
          )}.png`,
          label,
          bytes,
        },
      ] as const;
    }),
  );

  return new Map(fetched.filter((entry) => entry !== null));
}
