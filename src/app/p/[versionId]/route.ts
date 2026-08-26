/**
 * Serves one version's prototype HTML.
 *
 * This route is the whole reason the same-origin constraint in CLAUDE.md is
 * satisfiable. The review page shows the prototype in an iframe and needs to
 * read and modify that iframe's DOM -- detecting which screen is showing,
 * outlining an element the reviewer clicked, and so on in chunks 6 to 8.
 *
 * Browsers only allow that when the iframe's document comes from the same
 * origin as the page framing it. A Vercel Blob URL is a different origin, so
 * pointing the iframe straight at Blob would work visually and then fail the
 * moment the parent tried to touch the document. Fetching the file here and
 * re-serving it from our own domain is what keeps the two on one origin.
 *
 * So: never link an iframe at the Blob URL. Always point it here.
 *
 * Access is checked below: the admin, or a reviewer holding a valid pass for
 * the prototype this version belongs to. Without that the response is a 404.
 */

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { version } from "@/db/schema";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { getPrototypeHtmlStream } from "@/lib/prototype-storage";
import { hasValidPass, passCookieName } from "@/lib/reviewer-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;

  // Anything that is not a UUID cannot match a row, and passing it to Postgres
  // as a uuid comparison would raise a type error rather than return nothing.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      htmlBlobUrl: version.htmlBlobUrl,
      prototypeId: version.prototypeId,
    })
    .from(version)
    .where(eq(version.id, versionId))
    .limit(1);

  if (!row) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Who is allowed to see the file: the admin, or a reviewer who has entered
  // this prototype's password. Version ids are UUIDs and are not published
  // anywhere, but that is obscurity, not access control.
  const store = await cookies();
  const isAdmin = await verifySessionToken(store.get(ADMIN_COOKIE)?.value);
  const isReviewer = await hasValidPass(
    store.get(passCookieName(row.prototypeId))?.value,
    row.prototypeId,
  );

  if (!isAdmin && !isReviewer) {
    // 404 rather than 403: someone without access learns nothing about
    // whether this version exists.
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = await getPrototypeHtmlStream(row.htmlBlobUrl);
  if (!stream) {
    return new NextResponse("The prototype file is missing from storage", {
      status: 404,
    });
  }

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // A version's HTML never changes -- a new upload creates a new version
      // with a new id -- so it is safe to cache hard. `private` keeps it in the
      // reviewer's browser rather than a shared CDN cache.
      "Cache-Control": "private, max-age=3600",
      // The prototype is ours and is framed by our own review page. Denying
      // other sites the ability to frame it costs nothing.
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
