/**
 * A reference to something in the prototype, as everything else sees it.
 *
 * The row is in src/db/schema.ts; this is the small shape that travels between
 * the server and the browser, plus the one URL that turns a row into a picture.
 *
 * Pure and free of the database, so a client component can import it without
 * dragging server code into the browser bundle -- the same reason
 * reviewer-role.ts is written this way.
 */

/** One thing the reviewer pointed at. */
export interface AnnotationRef {
  id: string;
  /** The screen it was on, when the prototype says which screen it is on. */
  screenId: string | null;
  /** What to call it, in words. See describeElement in prototype-eyes.ts. */
  label: string | null;
  /** Where to fetch the picture. Null when the picture is missing. */
  imageUrl: string | null;
}

/**
 * Where a browser fetches an annotation's picture from.
 *
 * Never the Vercel Blob URL. Those are private -- the file cannot be fetched
 * without the store's token -- so this route is the only way in, and it is
 * where the check on who is asking lives.
 */
export function annotationImageUrl(id: string): string {
  return `/api/annotation/${id}/image`;
}

/** A short human-readable version of a reference, for a chip or a caption. */
export function describeRef(ref: AnnotationRef): string {
  const what = ref.label?.trim() || "the area you picked";
  return ref.screenId ? `${what} — ${ref.screenId}` : what;
}
