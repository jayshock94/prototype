/**
 * "Which review session is this request, and is it allowed?"
 *
 * Every feedback route needs the same three answers: the pass cookie is valid
 * for this prototype, the session cookie names a real session, and that session
 * belongs to this prototype rather than someone else's. Chunk 4 answered them
 * inline in /api/chat; chunk 5 adds three more routes that need the identical
 * check, and three copies of a security check is two too many.
 *
 * Returns null rather than throwing. Every caller turns that into a 401.
 */

import "server-only";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb } from "@/db";
import { prototype, session, version } from "@/db/schema";
import {
  hasValidPass,
  passCookieName,
  readSessionId,
  sessionCookieName,
} from "@/lib/reviewer-auth";

export interface ReviewerSession {
  sessionId: string;
  versionId: string;
  reviewerName: string;
  completedAt: Date | null;
}

export async function currentReviewerSession(
  prototypeId: string,
): Promise<ReviewerSession | null> {
  const store = await cookies();

  const passed = await hasValidPass(
    store.get(passCookieName(prototypeId))?.value,
    prototypeId,
  );
  if (!passed) return null;

  const sessionId = await readSessionId(
    store.get(sessionCookieName(prototypeId))?.value,
    prototypeId,
  );
  if (!sessionId) return null;

  // The join is the point: it proves the session hangs off a version of *this*
  // prototype. Without it, a cookie naming a session from another prototype
  // would read as valid here.
  const [row] = await getDb()
    .select({
      sessionId: session.id,
      versionId: session.versionId,
      reviewerName: session.reviewerName,
      completedAt: session.completedAt,
    })
    .from(session)
    .innerJoin(version, eq(version.id, session.versionId))
    .innerJoin(prototype, eq(prototype.id, version.prototypeId))
    .where(and(eq(session.id, sessionId), eq(prototype.id, prototypeId)))
    .limit(1);

  return row ?? null;
}
