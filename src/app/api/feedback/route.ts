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

import { getDb } from "@/db";
import { feedback } from "@/db/schema";
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

  const [row] = await getDb()
    .insert(feedback)
    .values({
      sessionId: reviewer.sessionId,
      screenId,
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

  return NextResponse.json({ item: row });
}
