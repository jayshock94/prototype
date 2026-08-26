"use client";

import { useTransition } from "react";

import { ExpandMoreIcon } from "@/components/m3/icons";
import {
  DISPOSITIONS,
  DISPOSITION_CLASSES,
  DISPOSITION_LABELS,
} from "@/lib/feedback";
import type { Disposition } from "@/db/schema";

import { setDisposition } from "./actions";

/**
 * Triage control for one item.
 *
 * A native select behind a pill, the same trick the reviewer's severity picker
 * uses, and for the same reason: triaging a list of thirty items should be
 * thirty single clicks, not thirty dialogs. Saving happens on change -- there
 * is no save button, because there is nothing to lose by getting it wrong and
 * changing it again.
 */
export function DispositionPicker({
  prototypeId,
  feedbackId,
  value,
}: {
  prototypeId: string;
  feedbackId: string;
  value: Disposition | null;
}) {
  const [pending, startTransition] = useTransition();

  /*
   * Untriaged is drawn as an outline, every disposition as a fill.
   *
   * Not decoration: "Won't do" is deliberately the quietest of the four fills,
   * which made it indistinguishable from untriaged when both were the same
   * neutral container. An empty outline versus a filled pill says "nobody has
   * looked at this" versus "somebody decided", which is the distinction the
   * whole page is for.
   */
  const classes = value
    ? DISPOSITION_CLASSES[value]
    : "border border-dashed border-outline text-on-surface-variant";

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center gap-0.5 rounded-full py-1 pl-3 pr-1.5 text-label-medium",
        classes,
        pending ? "opacity-60" : "",
      ].join(" ")}
    >
      {value ? DISPOSITION_LABELS[value] : "Not triaged"}
      <ExpandMoreIcon className="size-4" />
      <select
        aria-label="What to do about this"
        value={value ?? ""}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value === "" ? null : (e.target.value as Disposition);
          startTransition(async () => {
            await setDisposition(prototypeId, feedbackId, next);
          });
        }}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        <option value="">Not triaged</option>
        {DISPOSITIONS.map((d) => (
          <option key={d} value={d}>
            {DISPOSITION_LABELS[d]}
          </option>
        ))}
      </select>
    </span>
  );
}
