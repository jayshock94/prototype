/**
 * A crude but effective check that an upload really is an HTML document.
 * Stops a stray image or archive renamed to .html being served as a prototype.
 *
 * Kept in its own module because both sides use it: the form checks the file
 * the moment it is chosen, so a mistake never costs a round trip, and the
 * server action checks it again on arrival because client-side validation is a
 * convenience, never a guarantee. One definition means the two cannot disagree.
 */
export function looksLikeHtml(head: string): boolean {
  const start = head.slice(0, 2000).toLowerCase();
  return start.includes("<!doctype html") || start.includes("<html");
}
