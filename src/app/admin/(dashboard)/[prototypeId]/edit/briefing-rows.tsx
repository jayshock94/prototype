"use client";

/**
 * The two repeatable lists in the edit form: tasks and acceptance criteria.
 *
 * A textarea would have been less code, but neither of these is one field per
 * line. A task is a goal plus what success looks like; a criterion is a
 * reference plus its text plus whether it can be checked here at all. Squeezing
 * those into a line format would mean inventing a syntax and then teaching it
 * to whoever fills the form in.
 *
 * Rows are held in React state and written out as indexed inputs --
 * `task.0.goal`, `task.1.goal` -- which `src/lib/briefing.ts` reads back. The
 * index is a grouping key only. Removing the middle of three rows leaves a gap
 * in the numbering, and that is fine: the parser sorts by index and ignores the
 * gaps, so nothing has to be renumbered as you type.
 *
 * Each row carries a `key` that is not its index, so React keeps the right DOM
 * node when a row above is deleted. Keying by index is the classic version of
 * this bug: delete the first of three rows and the text appears to jump.
 */

import { useState } from "react";

import { IconButton } from "@/components/m3/icon-button";
import { Button } from "@/components/m3/button";
import { Checkbox } from "@/components/m3/checkbox";
import { AddIcon, CloseIcon } from "@/components/m3/icons";
import { TextArea } from "@/components/m3/text-area";
import { TextField } from "@/components/m3/text-field";
import type { CriterionDraft, TaskDraft } from "@/lib/briefing";

/** A stable key per row, independent of position. */
let nextKey = 0;
function keyed<T>(items: T[]): { key: number; value: T }[] {
  return items.map((value) => ({ key: nextKey++, value }));
}

function RowShell({
  index,
  label,
  onRemove,
  children,
}: {
  index: number;
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 rounded-sm border border-outline-variant p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-label-medium text-on-surface-variant">
          {label} {index + 1}
        </p>
        {children}
      </div>
      <IconButton type="button" aria-label={`Remove ${label} ${index + 1}`} onClick={onRemove}>
        <CloseIcon className="size-5" />
      </IconButton>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-dashed border-outline-variant px-4 py-6 text-center text-body-medium text-on-surface-variant">
      {children}
    </p>
  );
}

export function TaskRows({ initial }: { initial: TaskDraft[] }) {
  const [rows, setRows] = useState(() => keyed(initial));

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <EmptyHint>
          No tasks. The assistant will not ask anyone to try anything, which is
          right for a prototype you only want opinions on.
        </EmptyHint>
      ) : null}

      {rows.map((row, index) => (
        <RowShell
          key={row.key}
          index={index}
          label="Task"
          onRemove={() => setRows((current) => current.filter((r) => r.key !== row.key))}
        >
          <input type="hidden" name={`task.${index}.id`} value={row.value.id} />
          <TextField
            id={`task-${row.key}-goal`}
            name={`task.${index}.goal`}
            label="What to try"
            defaultValue={row.value.goal}
            supportingText="Phrase it as the thing they are trying to get done, not the buttons to press."
          />
          <TextField
            id={`task-${row.key}-success`}
            name={`task.${index}.successState`}
            label="What done looks like (optional)"
            defaultValue={row.value.successState}
          />
        </RowShell>
      ))}

      <div>
        <Button
          type="button"
          variant="tonal"
          icon={<AddIcon className="size-[18px]" />}
          onClick={() =>
            setRows((current) => [
              ...current,
              { key: nextKey++, value: { id: "", goal: "", successState: "" } },
            ])
          }
        >
          Add a task
        </Button>
      </div>
    </div>
  );
}

export function CriterionRows({ initial }: { initial: CriterionDraft[] }) {
  const [rows, setRows] = useState(() => keyed(initial));

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <EmptyHint>
          No criteria. Nothing will be checked off, and the report will not have
          an acceptance section.
        </EmptyHint>
      ) : null}

      {rows.map((row, index) => (
        <RowShell
          key={row.key}
          index={index}
          label="Criterion"
          onRemove={() => setRows((current) => current.filter((r) => r.key !== row.key))}
        >
          <input type="hidden" name={`criterion.${index}.id`} value={row.value.id} />
          <TextField
            id={`criterion-${row.key}-ref`}
            name={`criterion.${index}.ref`}
            label="Reference (optional)"
            defaultValue={row.value.ref}
            supportingText="Whatever the ticket calls it, for example AC3."
          />
          <TextArea
            id={`criterion-${row.key}-text`}
            name={`criterion.${index}.text`}
            label="What it says"
            rows={2}
            defaultValue={row.value.text}
          />
          {/*
            Inverted on purpose. The checkbox asks the question the person
            filling the form is actually asking themselves -- "can this even be
            checked here?" -- and an unticked box is the common case, so the
            common case needs no action. src/lib/briefing.ts flips it back.
          */}
          <Checkbox
            id={`criterion-${row.key}-unverifiable`}
            name={`criterion.${index}.notVerifiable`}
            label="Cannot be checked in a prototype"
            defaultChecked={!row.value.verifiableInPrototype}
            supportingText="Tick for anything about timing, emails, real data or another system. The assistant will say so rather than let a reviewer guess."
          />
        </RowShell>
      ))}

      <div>
        <Button
          type="button"
          variant="tonal"
          icon={<AddIcon className="size-[18px]" />}
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                key: nextKey++,
                value: { id: "", ref: "", text: "", verifiableInPrototype: true },
              },
            ])
          }
        >
          Add a criterion
        </Button>
      </div>
    </div>
  );
}
