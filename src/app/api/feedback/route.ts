/**
 * Adding a feedback item by hand.
 *
 * The assistant records most feedback itself, from the conversation -- that is
 * the whole point of chunk 5. This route is the path that does not go through
 * Claude at all, and it exists for two reasons:
 *
 *  1. Some reviewers would rather fill in a short form than have a
 *     conversation about it, and making them chat to log a typo is friction
 *     dressed up as a feature.
 *  2. If the Anthropic API is down or unconfigured, feedback still has to be
 *     capturable. Losing a reviewing session because a third party is having a
 *     bad afternoon is not acceptable.
 */

import { NextResponse } from "next/server";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { annotation, feedback } from "@/db/schema";
import { annotationImageUrl } from "@/lib/annotation";
import { cleanField, isSeverity } from "@/lib/feedback";
import { currentReviewerSession } from "@/lib/reviewer-session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const prototypeId = String(payload.prototypeId ?? "");
  if (!UUID.test(prototypeId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const reviewer = await currentReviewerSession(prototypeId);
  if (!reviewer) {
    return NextResponse.json({ error: "No review session." }, { status: 401 });
  }

  const happened = cleanField(payload.happened);
  const expected = cleanField(payload.expected);
  const note = cleanField(payload.note);
  const screenId = cleanField(payload.screenId);

  // Same rule the tool call gets: an item with no text in it says nothing.
  if (!happened && !expected && !note) {
    return NextResponse.json(
      { error: "Say what happened, what you expected, or add a note." },
      { status: 400 },
    );
  }

  const db = getDb();

  /*
   * The reference, if the reviewer pointed at something before saying this.
   *
   * An annotation id arriving from the browser is user input like anything
   * else, so it is looked up scoped to this session. An id belonging to
   * somebody else's review matches nothing and the item is saved without a
   * picture, rather than the save failing -- what the reviewer said is the
   * part worth keeping, and losing it over a stale reference would be a poor
   * trade.
   */
  let attached: {
    id: string;
    screenId: string | null;
    label: string | null;
    hasImage: boolean;
  } | null = null;

  const annotationId = cleanField(payload.annotationId);
  if (annotationId && UUID.test(annotationId)) {
    const [found] = await db
      .select({
        id: annotation.id,
        screenId: annotation.screenId,
        label: annotation.label,
        screenshotBlobUrl: annotation.screenshotBlobUrl,
      })
      .from(annotation)
      .where(
        and(
          eq(annotation.id, annotationId),
          eq(annotation.sessionId, reviewer.sessionId),
        ),
      )
      .limit(1);

    if (found) {
      attached = {
        id: found.id,
        screenId: found.screenId,
        label: found.label,
        hasImage: Boolean(found.screenshotBlobUrl),
      };
    }
  }

  const [row] = await db
    .insert(feedback)
    .values({
      sessionId: reviewer.sessionId,
      annotationId: attached?.id ?? null,
      // A reference knows which screen it was taken on, and that is a fact
      // rather than a guess, so it wins over anything the assistant inferred
      // or the reviewer typed.
      screenId: attached?.screenId ?? screenId,
      happened,
      expected,
      note,
      severity: isSeverity(payload.severity) ? payload.severity : "minor",
    })
    .returning({
      id: feedback.id,
      screenId: feedback.screenId,
      expected: feedback.expected,
      happened: feedback.happened,
      note: feedback.note,
      severity: feedback.severity,
    });

  return NextResponse.json({
    item: {
      ...row,
      annotation: attached
        ? {
            id: attached.id,
            screenId: attached.screenId,
            label: attached.label,
            imageUrl: attached.hasImage ? annotationImageUrl(attached.id) : null,
          }
        : null,
    },
  });
}
