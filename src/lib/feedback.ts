/**
 * The shared vocabulary of a feedback item.
 *
 * Both sides of the app need this: the reviewer panel renders severities as
 * chips, and the admin area filters and triages by them. Keeping the labels in
 * one file means a severity is never called two different things in two
 * different places.
 *
 * The enum *values* live in the database (src/db/schema.ts). What is here is
 * only how they are worded and ordered for people.
 */

import type { AnnotationRef } from "@/lib/annotation";
import type { Disposition, Severity } from "@/db/schema";

/**
 * Worst first. Used for sorting and for laying out filter controls, so the
 * thing most likely to stop a release is the thing read first.
 */
export const SEVERITIES: Severity[] = [
  "blocker",
  "major",
  "minor",
  "preference",
  "new_request",
];

/**
 * How each severity is worded for a reviewer.
 *
 * These are deliberately plain. A reviewer is not a QA engineer and will not
 * reliably tell "major" from "minor" out of context, so each carries a short
 * description that says what it means in practice. The assistant is given the
 * same wording in its tool schema, so its guess and the reviewer's correction
 * are working from one definition.
 */
export const SEVERITY_LABELS: Record<Severity, string> = {
  blocker: "Blocker",
  major: "Major",
  minor: "Minor",
  preference: "Preference",
  new_request: "New request",
};

export const SEVERITY_DESCRIPTIONS: Record<Severity, string> = {
  blocker: "Stops the user getting through the task at all.",
  major: "The task can be completed, but something is clearly wrong.",
  minor: "A small problem that does not get in the way.",
  preference: "It works, but I would do it differently.",
  new_request: "Something that is not there and should be.",
};

/**
 * Colour roles per severity.
 *
 * Error roles for the two that block work, ordinary container roles for the
 * rest. Deliberately restrained: if every severity is loud then none of them
 * is, and a page of red tells the designer nothing about where to start.
 */
export const SEVERITY_CLASSES: Record<Severity, string> = {
  blocker: "bg-error text-on-error",
  major: "bg-error-container text-on-error-container",
  minor: "bg-secondary-container text-on-secondary-container",
  preference: "bg-surface-container-highest text-on-surface-variant",
  new_request: "bg-tertiary-container text-on-tertiary-container",
};

export const DISPOSITIONS: Disposition[] = [
  "done",
  "wont_do",
  "deferred",
  "needs_discussion",
];

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  done: "Done",
  wont_do: "Won't do",
  deferred: "Deferred",
  needs_discussion: "Needs discussion",
};

export const DISPOSITION_CLASSES: Record<Disposition, string> = {
  done: "bg-tertiary-container text-on-tertiary-container",
  wont_do: "bg-surface-container-highest text-on-surface-variant",
  deferred: "bg-secondary-container text-on-secondary-container",
  needs_discussion: "bg-error-container text-on-error-container",
};

export function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && (SEVERITIES as string[]).includes(value);
}

export function isDisposition(value: unknown): value is Disposition {
  return typeof value === "string" && (DISPOSITIONS as string[]).includes(value);
}

/**
 * One feedback item as the reviewer's browser sees it.
 *
 * A narrower shape than the database row: the reviewer has no business knowing
 * about dispositions, which are the designer's private triage.
 */
export interface FeedbackItem {
  id: string;
  screenId: string | null;
  expected: string | null;
  happened: string | null;
  note: string | null;
  severity: Severity;
  /**
   * The thing in the prototype this item points at, when the reviewer pointed
   * at one.
   *
   * Optional and usually absent. Most feedback is a sentence about a screen and
   * needs no picture; the reference is for the case where saying which button
   * takes longer than showing it.
   */
  annotation?: AnnotationRef | null;
}

/**
 * A proposal the reviewer has not agreed to yet.
 *
 * The same shape as a saved item minus the database id, because there is no
 * row: the assistant put a card up and the reviewer has not pressed Save. The
 * id it does carry is invented by the server for this card alone, so the panel
 * has something to key on and so Save knows which draft it is saving. It is
 * deliberately named differently from `id`, so nothing can pass a draft to
 * something expecting a saved row and have it typecheck.
 */
export interface FeedbackDraft {
  draftId: string;
  screenId: string | null;
  expected: string | null;
  happened: string | null;
  note: string | null;
  severity: Severity;
}

/**
 * A one-line summary of an item, for places too tight for the full card.
 *
 * Falls back through the fields in the order that carries the most meaning:
 * what went wrong first, then what was wanted, then any loose note.
 */
export function summarise(item: FeedbackItem): string {
  return (
    item.happened?.trim() ||
    item.expected?.trim() ||
    item.note?.trim() ||
    "Feedback"
  );
}

/** Guards a single free-text field against a runaway paste. */
export const MAX_FIELD_CHARS = 2000;

/**
 * Trim a free-text field arriving from the browser or from a tool call.
 *
 * Returns null for anything empty, because the columns are nullable and an
 * empty string in a nullable column is a third state nobody wants to reason
 * about.
 */
export function cleanField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_FIELD_CHARS);
}
