/**
 * Changing or removing one feedback item, as the reviewer who logged it.
 *
 * Both handlers scope their WHERE to the session id from the cookie as well as
 * the item id. An item id in a URL is therefore not enough to touch it: you
 * have to be holding the session that created it. That is what stops one
 * reviewer editing another's feedback by guessing a UUID.
 *
 * Only severity is editable. Everything else is what the reviewer said, and
 * letting them rewrite the text after the fact turns the record into a draft.
 * Getting it wrong is handled by deleting and saying it again.
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { feedback } from "@/db/schema";
import { isSeverity } from "@/lib/feedback";
import { currentReviewerSession } from "@/lib/reviewer-session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the caller and the target together.
 *
 * Returns a NextResponse on failure so the handlers can return it directly,
 * which keeps the happy path in each of them a single unindented block.
 */
async function authorise(
  request: Request,
  id: string,
): Promise<{ sessionId: string } | NextResponse> {
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // The prototype id travels in the query string rather than the body, because
  // DELETE requests with bodies are awkward and inconsistently supported.
  const prototypeId = new URL(request.url).searchParams.get("prototypeId") ?? "";
  if (!UUID.test(prototypeId)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const reviewer = await currentReviewerSession(prototypeId);
  if (!reviewer) {
    return NextResponse.json({ error: "No review session." }, { status: 401 });
  }

  return { sessionId: reviewer.sessionId };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authorise(request, id);
  if (auth instanceof NextResponse) return auth;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (!isSeverity(payload.severity)) {
    return NextResponse.json({ error: "Unknown severity." }, { status: 400 });
  }

  const [row] = await getDb()
    .update(feedback)
    .set({ severity: payload.severity })
    .where(and(eq(feedback.id, id), eq(feedback.sessionId, auth.sessionId)))
    .returning({ id: feedback.id, severity: feedback.severity });

  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ item: row });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authorise(request, id);
  if (auth instanceof NextResponse) return auth;

  const [row] = await getDb()
    .delete(feedback)
    .where(and(eq(feedback.id, id), eq(feedback.sessionId, auth.sessionId)))
    .returning({ id: feedback.id });

  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
