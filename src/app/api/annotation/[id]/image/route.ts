/**
 * Serving one annotation's screenshot.
 *
 * Screenshots live in Vercel Blob with `access: "private"`, so there is no URL
 * that loads one -- the same decision that makes /p/[versionId] the only way to
 * see a prototype. This is the equivalent route for pictures, and it is where
 * the question "who is asking?" is answered.
 *
 * Two answers are accepted:
 *
 *  - **The admin**, who reads every review in /admin/[prototypeId]/feedback.
 *  - **The reviewer who took it**, and nobody else. Not "a reviewer of this
 *    prototype": the session cookie has to name the session the annotation
 *    hangs off. A picture of an unreleased design is not something to hand to
 *    the next person who happens to know the prototype's password.
 *
 * Everyone else gets a 404 rather than a 403, so nothing is revealed about
 * which annotations exist -- the same rule /p/[versionId] follows.
 */

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { annotation, prototype, session, version } from "@/db/schema";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { getAnnotationImage } from "@/lib/prototype-storage";
import {
  hasValidPass,
  passCookieName,
  readSessionId,
  sessionCookieName,
} from "@/lib/reviewer-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  // One query for the picture and everything needed to decide who may see it.
  const [row] = await getDb()
    .select({
      screenshotBlobUrl: annotation.screenshotBlobUrl,
      sessionId: annotation.sessionId,
      prototypeId: prototype.id,
    })
    .from(annotation)
    .innerJoin(session, eq(session.id, annotation.sessionId))
    .innerJoin(version, eq(version.id, session.versionId))
    .innerJoin(prototype, eq(prototype.id, version.prototypeId))
    .where(eq(annotation.id, id))
    .limit(1);

  if (!row?.screenshotBlobUrl) return notFound();

  const store = await cookies();

  const isAdmin = await verifySessionToken(store.get(ADMIN_COOKIE)?.value);

  let isOwner = false;
  if (!isAdmin) {
    const passed = await hasValidPass(
      store.get(passCookieName(row.prototypeId))?.value,
      row.prototypeId,
    );
    if (passed) {
      const sessionId = await readSessionId(
        store.get(sessionCookieName(row.prototypeId))?.value,
        row.prototypeId,
      );
      isOwner = sessionId === row.sessionId;
    }
  }

  if (!isAdmin && !isOwner) return notFound();

  const bytes = await getAnnotationImage(row.screenshotBlobUrl);
  if (!bytes) return notFound();

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(bytes.length),
      // An annotation's picture never changes -- pointing again makes a new
      // row -- so it caches hard. `private` keeps it out of any shared cache,
      // which matters because the response depends on who asked.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
