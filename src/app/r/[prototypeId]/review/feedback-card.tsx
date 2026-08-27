"use client";

import { Button } from "@/components/m3/button";
import { IconButton } from "@/components/m3/icon-button";
import { CheckIcon, DeleteIcon, ExpandMoreIcon } from "@/components/m3/icons";
import {
  SEVERITIES,
  SEVERITY_CLASSES,
  SEVERITY_LABELS,
  type FeedbackItem,
} from "@/lib/feedback";
import type { Severity } from "@/db/schema";

import { Thumbnail } from "./pointing";

/**
 * One feedback item, as the reviewer sees it. Two states.
 *
 * A **draft** is what the assistant just proposed. Nothing has been written;
 * the reviewer saves it or throws it away. It is drawn with a dashed edge and
 * says plainly that it is not saved, because the whole point is that a card
 * which has not been agreed to must never look like one that has.
 *
 * A **saved** item is a receipt. It exists so a reviewer can glance at what was
 * kept and carry on, which is why "expected" and "happened" are labelled rather
 * than run together into a sentence.
 *
 * In both states the one thing they can change is the severity, because that
 * is Claude's guess rather than their words. Everything else is what they
 * said: a draft they do not recognise should be discarded and said again, not
 * edited into shape.
 */
export function FeedbackCard({
  item,
  onSeverityChange,
  onDelete,
  onSave,
  busy = false,
}: {
  item: FeedbackItem | (Omit<FeedbackItem, "id"> & { id?: undefined });
  onSeverityChange: (severity: Severity) => void;
  /** Delete a saved item, or discard a draft. */
  onDelete: () => void;
  /** Present only on a draft. Its presence is what makes this a draft. */
  onSave?: () => void;
  busy?: boolean;
}) {
  const isDraft = Boolean(onSave);

  return (
    <div
      className={
        isDraft
          ? "rounded-md border border-dashed border-primary bg-surface-container-low px-3 py-2.5"
          : "rounded-md border border-outline-variant bg-surface-container px-3 py-2.5"
      }
    >
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
          aria-label={isDraft ? "Discard this draft" : "Delete this feedback"}
          onClick={onDelete}
          disabled={busy}
          className="-mr-1 -mt-1 size-8 text-on-surface-variant"
        >
          <DeleteIcon className="size-[18px]" />
        </IconButton>
      </div>

      {/*
        The picture, when they pointed at something. Above the words rather
        than beside them: in a panel this narrow a thumbnail in a row is too
        small to recognise, and recognising it is the entire job.
      */}
      {item.annotation ? (
        <div className="mt-2 overflow-hidden rounded-sm border border-outline-variant bg-surface">
          <Thumbnail
            reference={item.annotation}
            className="max-h-40 w-full object-contain"
          />
        </div>
      ) : null}

      <dl className="mt-1.5 flex flex-col gap-1 text-body-small">
        {item.happened ? (
          <Line label="What happened">{item.happened}</Line>
        ) : null}
        {item.expected ? (
          <Line label="Expected">{item.expected}</Line>
        ) : null}
        {item.note ? <Line label="Note">{item.note}</Line> : null}
      </dl>

      {/* Only on a draft. A saved item needs no footer -- it is already kept,
          and a Save button on something already saved is a lie. */}
      {isDraft ? (
        <div className="mt-2.5 flex items-center gap-2 border-t border-outline-variant pt-2.5">
          <Button
            variant="filled"
            onClick={onSave}
            disabled={busy}
            icon={<CheckIcon className="size-[18px]" />}
            className="h-8 px-4"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          <p className="text-body-small text-on-surface-variant">
            Not saved yet
          </p>
        </div>
      ) : null}
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
