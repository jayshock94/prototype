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

import { del, get, head, put } from "@vercel/blob";

import { blobToken } from "@/lib/env";

// Re-exported so server code has one import for the upload limit and its
// formatting; the helper itself lives somewhere the browser can import too.
export { formatBytes } from "@/components/m3/format";

/**
 * The size ceiling for an uploaded prototype.
 *
 * Prototype HTML does NOT travel through a server action -- the browser uploads
 * it straight to Blob. That matters: a Vercel function may only receive a 4.5 MB
 * request body, and a self-contained prototype with images inlined as base64
 * goes past that easily. Going browser-to-Blob sidesteps the function entirely,
 * so the only limit is the one we choose here.
 *
 * 50 MB is a guard against an obvious mistake -- someone picking a video -- not
 * a technical boundary. Raise it if real prototypes need more.
 */
export const MAX_PROTOTYPE_BYTES = 50 * 1024 * 1024;

/**
 * Knowledge base markdown is small, so unlike the prototype it still travels
 * with the form and is bounded by the server action body limit in
 * next.config.ts. Keep this comfortably under that.
 */
export const MAX_KNOWLEDGE_BASE_BYTES = 1024 * 1024;

/**
 * Above this size the upload is split into parts that are sent in parallel and
 * retried individually, so one dropped chunk does not restart the whole thing.
 *
 * 8 MB is not arbitrary: it is the part size the Blob SDK itself uses. A file
 * smaller than one part still becomes exactly one part, so multipart would add
 * two extra round trips (create, then complete) and buy nothing -- no
 * parallelism, and the same single request to retry. Splitting only starts
 * paying once there is genuinely more than one part.
 */
export const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;

/** Where a prototype's HTML lives in the store, given the prototype's id. */
export function prototypePathname(prototypeId: string, versionLabel: string): string {
  return `prototypes/${prototypeId}/${versionLabel}.html`;
}

/**
 * Is this blob pathname one this prototype is allowed to claim?
 *
 * The browser tells the server which blob it just uploaded, and the server must
 * not simply believe it. Binding the pathname to the prototype id means an
 * upload cannot be pointed at some other prototype's file.
 */
export function pathnameBelongsToPrototype(
  pathname: string,
  prototypeId: string,
): boolean {
  return pathname.startsWith(`prototypes/${prototypeId}/`);
}

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

/**
 * Confirm a blob really exists in our store, and report its size and type.
 *
 * This is the check that makes client-side uploads safe to trust. The browser
 * hands us a URL and says "I uploaded this"; `head` asks our own store whether
 * that is true. The token is scoped to one store, so a URL pointing at someone
 * else's blob cannot pass. Returns null when there is nothing there.
 */
export async function headPrototypeBlob(blobUrl: string): Promise<{
  pathname: string;
  size: number;
  contentType: string | undefined;
} | null> {
  try {
    const result = await head(blobUrl, { token: blobToken() });
    return {
      pathname: result.pathname,
      size: result.size,
      contentType: result.contentType,
    };
  } catch {
    return null;
  }
}

/**
 * Read the first few kilobytes of a blob, to check it is what it claims to be.
 *
 * Only the opening chunk is read and the stream is then cancelled, so this
 * costs about the same for a 50 MB file as for a small one.
 */
export async function readPrototypeHead(blobUrl: string, bytes = 4096): Promise<string> {
  const stream = await getPrototypeHtmlStream(blobUrl);
  if (!stream) return "";

  const reader = stream.getReader();
  try {
    const { value } = await reader.read();
    if (!value) return "";
    return new TextDecoder().decode(value.slice(0, bytes));
  } finally {
    // Stop the download rather than letting the rest of the file arrive.
    await reader.cancel().catch(() => {});
  }
}

/**
 * Remove a blob.
 *
 * Used to clean up after a rejected upload: the browser uploads the file before
 * the form is submitted, so anything the server then refuses would otherwise
 * sit in the store forever with nothing pointing at it.
 */
export async function deletePrototypeBlob(blobUrl: string): Promise<void> {
  try {
    await del(blobUrl, { token: blobToken() });
  } catch {
    // A failed cleanup must never turn into the error the user sees -- they
    // came here to be told what was wrong with their upload.
  }
}
