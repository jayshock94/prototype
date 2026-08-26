/**
 * Issues the short-lived token a browser needs to upload a prototype straight
 * to Blob storage.
 *
 * Why the browser uploads directly: a Vercel function may only receive a 4.5 MB
 * request body, and a self-contained prototype with images inlined as base64
 * goes past that easily. Sending the file through a server action puts a hard
 * ceiling on prototype size that no configuration can lift. Going
 * browser-to-Blob removes the function from the path entirely.
 *
 * The browser never sees BLOB_READ_WRITE_TOKEN. It asks this route for
 * permission, and this route hands back a token that is scoped to a single
 * pathname, a single content type, and a size cap, and expires shortly after.
 *
 * SECURITY: middleware only guards /admin, so this route is NOT protected by
 * it. The admin session is checked here explicitly. Without that check anyone
 * on the internet could mint upload tokens for our store.
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { blobToken } from "@/lib/env";
import { MAX_PROTOTYPE_BYTES } from "@/lib/prototype-storage";

/** Only pathnames of this shape may be uploaded to. */
const ALLOWED_PATHNAME = /^prototypes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/v\d+\.html$/i;

export async function POST(request: Request) {
  const store = await cookies();
  const isAdmin = await verifySessionToken(store.get(ADMIN_COOKIE)?.value);
  if (!isAdmin) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),

      // There is deliberately no onUploadCompleted handler.
      //
      // Vercel calls that one by webhook when an upload finishes, which cannot
      // reach a laptop -- so it never fires in local development, and wiring
      // row creation to it would mean uploads worked in production and
      // silently did nothing locally. Instead the browser submits the blob URL
      // with the rest of the form and the server action writes the rows, after
      // verifying the blob really exists in our store. Supplying an unused
      // handler also makes the SDK ask for a callbackUrl it does not need.
      onBeforeGenerateToken: async (pathname) => {
        // The browser proposes the pathname, so it has to be checked. Anything
        // outside the prototypes/<uuid>/ shape is refused.
        if (!ALLOWED_PATHNAME.test(pathname)) {
          throw new Error(`Refusing to issue a token for pathname "${pathname}".`);
        }

        return {
          // Uploads are private: the file cannot be fetched from Blob without
          // the store token, so /p/[versionId] stays the only way in.
          allowedContentTypes: ["text/html"],
          maximumSizeInBytes: MAX_PROTOTYPE_BYTES,
          addRandomSuffix: true,
          // Two minutes is plenty to start an upload and far too short to be
          // worth stealing.
          validUntil: Date.now() + 2 * 60 * 1000,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
