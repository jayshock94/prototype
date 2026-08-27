"use client";

import { IconButton } from "@/components/m3/icon-button";
import { DeleteIcon, ExpandMoreIcon } from "@/components/m3/icons";
import {
  SEVERITIES,
  SEVERITY_CLASSES,
  SEVERITY_LABELS,
  type FeedbackItem,
} from "@/lib/feedback";
import type { Severity } from "@/db/schema";

/**
 * One recorded item, as the reviewer sees it.
 *
 * This is a receipt, not a form. It exists so a reviewer can glance at what was
 * captured from what they just said and carry on -- so the whole card has to be
 * readable without being read, which is why "expected" and "happened" are
 * labelled rather than run together into a sentence.
 *
 * The two things they can change are the two things most likely to be wrong:
 * the severity Claude guessed, and whether the item should exist at all.
 * Everything else is what they said, and letting them rewrite it after the fact
 * turns a record of a review into a draft of one.
 */
export function FeedbackCard({
  item,
  onSeverityChange,
  onDelete,
  busy = false,
}: {
  item: FeedbackItem;
  onSeverityChange: (severity: Severity) => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container px-3 py-2.5">
      <div className="flex items-start gap-2">
        <SeverityPicker
          value={item.severity}
          disabled={busy}
          onChange={onSeverityChange}
        />

        {item.screenId ? (
          <span className="min-w-0 flex-1 truncate pt-0.5 text-label-medium text-on-surface-variant">
            {item.screenId}
          </span>
        ) : (
          <span className="flex-1" />
        )}

        <IconButton
          aria-label="Delete this feedback"
          onClick={onDelete}
          disabled={busy}
          className="-mr-1 -mt-1 size-8 text-on-surface-variant"
        >
          <DeleteIcon className="size-[18px]" />
        </IconButton>
      </div>

      <dl className="mt-1.5 flex flex-col gap-1 text-body-small">
        {item.happened ? (
          <Line label="What happened">{item.happened}</Line>
        ) : null}
        {item.expected ? (
          <Line label="Expected">{item.expected}</Line>
        ) : null}
        {item.note ? <Line label="Note">{item.note}</Line> : null}
      </dl>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-on-surface-variant">{label}:</dt>
      <dd className="min-w-0 text-on-surface">{children}</dd>
    </div>
  );
}

/**
 * The severity badge, which is secretly a native select.
 *
 * A reviewer will not reliably tell "major" from "minor", and Claude is
 * guessing too -- so correcting it has to be as cheap as noticing it is wrong.
 * A transparent native <select> sits over the badge: it looks like a label,
 * behaves like a picker, and gets the platform's own menu on mobile plus
 * keyboard and screen-reader support for free.
 */
function SeverityPicker({
  value,
  disabled,
  onChange,
}: {
  value: Severity;
  disabled: boolean;
  onChange: (severity: Severity) => void;
}) {
  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center gap-0.5 rounded-full py-0.5 pl-2 pr-1 text-label-small",
        SEVERITY_CLASSES[value],
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      {SEVERITY_LABELS[value]}
      <ExpandMoreIcon className="size-3.5" />
      <select
        aria-label="Severity"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Severity)}
        /* Covers the badge exactly and is invisible, so the badge itself is the
           hit target. Not `display:none` -- that would take the control out of
           the accessibility tree along with the keyboard. */
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        {SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {SEVERITY_LABELS[s]}
          </option>
        ))}
      </select>
    </span>
  );
}
