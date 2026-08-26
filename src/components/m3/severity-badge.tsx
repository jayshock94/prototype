/**
 * A severity, shown as a small filled pill.
 *
 * Not an M3 chip: a chip is interactive, and this is a label. It reads as a
 * badge on a card, which is what an M3 "suggestion" or assist chip must never
 * be confused with.
 */

import { SEVERITY_CLASSES, SEVERITY_LABELS } from "@/lib/feedback";
import type { Severity } from "@/db/schema";

export function SeverityBadge({
  severity,
  className = "",
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-label-small",
        SEVERITY_CLASSES[severity],
        className,
      ].join(" ")}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
