/**
 * Turn the "one per line" reviewer textarea into a clean array.
 *
 * Blank lines are dropped, surrounding whitespace is trimmed, and repeats are
 * removed case-insensitively while keeping the capitalisation as typed -- so
 * "Priya Nair" and "priya nair" collapse to one entry that still reads the way
 * the admin wrote it first.
 *
 * In its own module, rather than inside the server action, because a file
 * marked "use server" may only export async functions -- and because a pure
 * function like this is worth being able to test on its own.
 */
export function parseReviewerNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const line of raw.split("\n")) {
    const name = line.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    names.push(name);
  }

  return names;
}
