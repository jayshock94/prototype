/**
 * Where prototype HTML files live.
 *
 * Uploaded files go to Vercel Blob. Everything to do with Blob is in this one
 * module so the rest of the app never imports the SDK directly -- if storage
 * ever changes, this file changes and nothing else does.
 *
 * Blobs are stored with `access: "private"`. That is the important decision
 * here. A public blob is readable by anyone who has its URL, forever, with no
 * password in front of it. Private means the file cannot be fetched without
 * the store's token, which only the server has. The only way to see a
 * prototype is through our own /p/[versionId] route -- which is exactly the
 * same-origin rule in CLAUDE.md, now enforced by the storage layer rather than
 * relying on everyone remembering it.
 */

import "server-only";

import { get, put } from "@vercel/blob";

import { blobToken } from "@/lib/env";

// Re-exported so server code has one import for the upload limit and its
// formatting; the helper itself lives somewhere the browser can import too.
export { formatBytes } from "@/components/m3/format";

/**
 * Vercel caps a serverless function's request body at 4.5 MB, so an upload
 * that goes through a server action cannot exceed it no matter what we set in
 * next.config.ts. We check up front to give a useful message instead of a bare
 * 413 from the platform.
 *
 * TODO: if prototypes routinely exceed this -- likely once images are inlined
 * as base64 -- switch to @vercel/blob/client, which uploads straight from the
 * browser to Blob and skips the function entirely.
 */
export const MAX_PROTOTYPE_BYTES = 4 * 1024 * 1024;

/**
 * Store one version's HTML and return the URL to record on the version row.
 *
 * The pathname groups files by prototype so the Blob dashboard stays readable.
 * `addRandomSuffix` keeps a re-upload of the same version label from silently
 * overwriting the previous file.
 */
export async function putPrototypeHtml({
  prototypeId,
  versionLabel,
  html,
}: {
  prototypeId: string;
  versionLabel: string;
  html: string | ArrayBuffer;
}): Promise<string> {
  const result = await put(`prototypes/${prototypeId}/${versionLabel}.html`, html, {
    access: "private",
    contentType: "text/html; charset=utf-8",
    addRandomSuffix: true,
    token: blobToken(),
  });

  return result.url;
}

/**
 * Turn a stored blob URL back into the blob's pathname.
 *
 * A Blob URL is `https://<store>.blob.vercel-storage.com/<pathname>`, so the
 * pathname is the URL's path with the leading slash removed.
 */
function pathnameFromBlobUrl(blobUrl: string): string | null {
  try {
    return decodeURIComponent(new URL(blobUrl).pathname).replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

/**
 * Read one version's HTML back.
 *
 * The SDK accepts either the blob's URL or its pathname, and resolves both to
 * the same authenticated fetch. We pass the URL we stored, because that is the
 * value we have and the one you can paste into the Vercel dashboard when
 * something looks wrong. The SDK rejects a URL that is not a Blob store URL,
 * so anything unexpected in that column falls back to being read as a
 * pathname rather than failing outright.
 *
 * Returns a stream rather than a string so a large prototype is piped straight
 * through to the browser instead of being held in the function's memory.
 * Returns null when the blob is missing, which the route turns into a 404.
 */
export async function getPrototypeHtmlStream(
  blobUrl: string,
): Promise<ReadableStream | null> {
  const isBlobStoreUrl = (() => {
    try {
      return new URL(blobUrl).hostname.endsWith(".blob.vercel-storage.com");
    } catch {
      return false;
    }
  })();

  const target = isBlobStoreUrl ? blobUrl : pathnameFromBlobUrl(blobUrl);
  if (!target) return null;

  const result = await get(target, {
    access: "private",
    token: blobToken(),
  });

  return result?.stream ?? null;
}
