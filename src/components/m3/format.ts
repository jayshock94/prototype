/**
 * Formatting helpers shared by client components.
 *
 * This is deliberately separate from src/lib/prototype-storage.ts, which is
 * server-only: importing that into a client component would pull the Vercel
 * Blob SDK into the browser bundle.
 */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
