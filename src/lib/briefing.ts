/**
 * The briefing: everything the assistant is told about a prototype beyond its
 * name and knowledge base.
 *
 * Four pieces, and they answer different questions:
 *
 *   mode      how hard the assistant pushes. On the prototype.
 *   scenario  the situation the reviewer is put in. On the version.
 *   tasks     what they are asked to try. Answers "could a person do it".
 *   criteria  what the ticket promised. Answers "does it do what was asked".
 *   notBuilt  what is deliberately absent, so the assistant can say "out of
 *             scope" instead of inventing behaviour.
 *
 * Tasks and criteria are both optional and independent. A prototype with
 * criteria and no tasks is a design review; one with tasks and no criteria is
 * a usability test; most real ones have both, which is the hybrid this whole
 * application is for.
 *
 * This module is pure. It holds no database and no React, because the same
 * parsing has to run in a server action, and because a function that only
 * turns form data into rows is worth being able to read on its own.
 */

import type { assistantModeEnum } from "@/db/schema";

export type AssistantMode = (typeof assistantModeEnum.enumValues)[number];

export const ASSISTANT_MODES = ["review", "browse", "verify", "off"] as const;

/** Shown in the admin picker. Kept here so the wording lives in one place. */
export const MODE_LABELS: Record<AssistantMode, string> = {
  review: "Review",
  browse: "Browse",
  verify: "Verify",
  off: "No assistant",
};

export const MODE_DESCRIPTIONS: Record<AssistantMode, string> = {
  browse:
    "Someone is looking around. The assistant answers what it is asked and never interrupts. Feedback is welcome but never requested.",
  review:
    "The usual choice. Tasks are offered once, feedback is asked for at natural moments, and the assistant interrupts only on a strong signal.",
  verify:
    "You need the acceptance criteria checked. The criteria are offered early and a decision is asked for at the end. The most assertive setting.",
  off:
    "No assistant at all. The reviewer sees the scenario and the tasks, and writes their own feedback on a form. Nothing is sent to Anthropic. Right when you want a plain feedback tool, or when the conversation would get in the way.",
};

/** True when this prototype has no assistant and is a plain feedback form. */
export function isAssistantOff(mode: AssistantMode): boolean {
  return mode === "off";
}

export function isAssistantMode(value: unknown): value is AssistantMode {
  return (
    typeof value === "string" &&
    (ASSISTANT_MODES as readonly string[]).includes(value)
  );
}

/* --------------------------------------------------------------------------
 * The shapes the form edits.
 *
 * Every row carries the id of the row it came from, empty for one that has
 * just been added. That is what lets a save update rows in place instead of
 * replacing the list wholesale, and it is not a nicety: a reviewer's verdict
 * on a criterion is a row that cascades when the criterion is deleted, so
 * "delete them all and insert the new list" would quietly throw away every
 * acceptance result the moment you fixed a typo. Tasks have no results table
 * yet, but they will after the next chunk, so they work the same way.
 *
 * An id in the form is still user input. The action only trusts one that
 * already belongs to the version being edited.
 * ------------------------------------------------------------------------ */

export interface TaskDraft {
  /** Empty for a row that has just been added in the browser. */
  id: string;
  goal: string;
  successState: string;
}

export interface CriterionDraft {
  /** Empty for a row that has just been added in the browser. */
  id: string;
  ref: string;
  text: string;
  /** False when it simply cannot be checked by clicking a prototype. */
  verifiableInPrototype: boolean;
}

/** How many of each we accept. A guard against a paste, not a design limit. */
export const MAX_ROWS = 40;

/** Longest a single goal, criterion or not-built line may be. */
export const MAX_ROW_CHARS = 500;

/* --------------------------------------------------------------------------
 * Reading the form
 *
 * Rows arrive as indexed fields -- task.0.goal, task.1.goal and so on --
 * because a repeatable list has no other honest way through a form. The index
 * is only used to group fields; gaps are fine and the order of the output is
 * the order of the indexes, so removing the middle row of three does not
 * renumber anything in the browser.
 * ------------------------------------------------------------------------ */

function indexedRows(formData: FormData, prefix: string): Map<number, FormData> {
  const rows = new Map<number, FormData>();

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(`${prefix}.`)) continue;

    const [, indexRaw, field] = key.split(".");
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 0 || !field) continue;

    let row = rows.get(index);
    if (!row) {
      row = new FormData();
      rows.set(index, row);
    }
    row.set(field, value);
  }

  return new Map([...rows.entries()].sort((a, b) => a[0] - b[0]));
}

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "")
    .trim()
    .slice(0, MAX_ROW_CHARS);
}

/**
 * Tasks from the form.
 *
 * A row with no goal is dropped rather than rejected. An empty row is what an
 * "add" button that was pressed and then thought better of leaves behind, and
 * refusing to save because of one is not helpful.
 */
export function parseTasks(formData: FormData): TaskDraft[] {
  const tasks: TaskDraft[] = [];

  for (const row of indexedRows(formData, "task").values()) {
    const goal = clean(row.get("goal"));
    if (!goal) continue;
    tasks.push({
      id: clean(row.get("id")),
      goal,
      successState: clean(row.get("successState")),
    });
    if (tasks.length >= MAX_ROWS) break;
  }

  return tasks;
}

/** Criteria from the form. A row with no text is dropped, as above. */
export function parseCriteria(formData: FormData): CriterionDraft[] {
  const criteria: CriterionDraft[] = [];

  for (const row of indexedRows(formData, "criterion").values()) {
    const text = clean(row.get("text"));
    if (!text) continue;
    criteria.push({
      id: clean(row.get("id")),
      ref: clean(row.get("ref")),
      text,
      // The form asks the inverse question -- "can this even be checked here?"
      // -- because unticked is the common case and the common case should need
      // no action. An unticked box sends nothing at all, which is how HTML
      // reports a checkbox, so absent means verifiable.
      verifiableInPrototype: row.get("notVerifiable") === null,
    });
    if (criteria.length >= MAX_ROWS) break;
  }

  return criteria;
}

/**
 * The not-built list, one per line.
 *
 * A textarea rather than repeatable rows, because each entry is a single
 * sentence with no other fields -- the same reasoning as the reviewer names
 * box, and it parses the same way, minus the de-duplication. Two similar
 * lines here are usually two genuinely different omissions.
 */
export function parseNotBuilt(raw: string): string[] {
  const items: string[] = [];

  for (const line of raw.split("\n")) {
    const text = line.trim().slice(0, MAX_ROW_CHARS);
    if (!text) continue;
    items.push(text);
    if (items.length >= MAX_ROWS) break;
  }

  return items;
}
