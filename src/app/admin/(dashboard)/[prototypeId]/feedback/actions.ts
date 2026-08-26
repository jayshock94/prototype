"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { feedback, session, version } from "@/db/schema";
import { isDisposition } from "@/lib/feedback";
import type { Disposition } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Triage one item.
 *
 * Only reachable from an admin page, and middleware has already checked the
 * admin session by the time this runs -- but the WHERE still pins the item to
 * the prototype in the URL. A server action is a public endpoint whatever page
 * it was defined on, so "it is only called from the admin area" is not a
 * security property.
 *
 * Null clears the disposition, which is how an item goes back to untriaged
 * after a wrong click.
 */
export async function setDisposition(
  prototypeId: string,
  feedbackId: string,
  value: Disposition | null,
): Promise<void> {
  if (!UUID.test(prototypeId) || !UUID.test(feedbackId)) return;
  if (value !== null && !isDisposition(value)) return;

  const db = getDb();

  // feedback -> session -> version is what says which prototype an item
  // belongs to. Expressed as a subquery because the update itself cannot join.
  const sessionsOfThisPrototype = db
    .select({ id: session.id })
    .from(session)
    .innerJoin(version, eq(version.id, session.versionId))
    .where(eq(version.prototypeId, prototypeId));

  await db
    .update(feedback)
    .set({ disposition: value })
    .where(
      and(
        eq(feedback.id, feedbackId),
        inArray(feedback.sessionId, sessionsOfThisPrototype),
      ),
    );

  revalidatePath(`/admin/${prototypeId}/feedback`);
}
