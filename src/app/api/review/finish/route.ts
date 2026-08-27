/**
 * Finishing a review, and changing your mind about it.
 *
 * "Finished" is one nullable timestamp on the session row. POST sets it,
 * DELETE clears it. There is nothing else to it -- no locking, no archiving,
 * no state machine. A finished session is simply one the reviewer has said
 * they are done with, which is what tells the designer the feedback is
 * complete rather than half-written.
 *
 * Reopening exists because a reviewer will press finish, read their own
 * summary, and immediately remember a fourth thing. Making that a dead end
 * would push them into emailing it instead, which is the habit this whole
 * application is trying to replace.
 */

import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { session } from "@/db/schema";
import { currentReviewerSession } from "@/lib/reviewer-session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolve(request: Request) {
  const prototypeId = new URL(request.url).searchParams.get("prototypeId") ?? "";
  if (!UUID.test(prototypeId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const reviewer = await currentReviewerSession(prototypeId);
  if (!reviewer) {
    return NextResponse.json({ error: "No review session." }, { status: 401 });
  }

  return reviewer;
}

export async function POST(request: Request) {
  const reviewer = await resolve(request);
  if (reviewer instanceof NextResponse) return reviewer;

  // Idempotent on purpose: pressing finish twice, or on a stale tab, should
  // not move the timestamp and make it look like the reviewer worked longer
  // than they did.
  const [row] = await getDb()
    .update(session)
    .set({ completedAt: new Date() })
    .where(and(eq(session.id, reviewer.sessionId), isNull(session.completedAt)))
    .returning({ completedAt: session.completedAt });

  return NextResponse.json({
    completedAt: (row?.completedAt ?? reviewer.completedAt)?.toISOString() ?? null,
  });
}

export async function DELETE(request: Request) {
  const reviewer = await resolve(request);
  if (reviewer instanceof NextResponse) return reviewer;

  await getDb()
    .update(session)
    .set({ completedAt: null })
    .where(eq(session.id, reviewer.sessionId));

  return NextResponse.json({ completedAt: null });
}
