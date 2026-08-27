"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/m3/button";
import { Select } from "@/components/m3/select";
import { TextField } from "@/components/m3/text-field";
import {
  REVIEWER_ROLES,
  ROLE_HINTS,
  ROLE_LABELS,
  type ReviewerRole,
} from "@/lib/reviewer-role";
import { enterName, type NameState } from "./actions";

/** Sentinel for the "Someone else" option, kept in step with actions.ts. */
const OTHER = "__other__";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? "Starting…" : "Start review"}
    </Button>
  );
}

export function NameForm({
  prototypeId,
  reviewerNames,
  askRole,
}: {
  prototypeId: string;
  reviewerNames: string[];
  /** False on a prototype with no assistant, where the answer goes unread. */
  askRole: boolean;
}) {
  const [state, formAction] = useActionState<NameState, FormData>(
    enterName,
    {},
  );
  const [choice, setChoice] = useState("");
  /*
   * Defaults to "other" rather than to nothing. A required picker with no
   * default is one more thing standing between a reviewer and the prototype,
   * and "other" is the answer that assumes least about them -- plain language,
   * no jargon. Someone who is a developer will say so.
   */
  const [role, setRole] = useState<ReviewerRole>("other");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="prototypeId" value={prototypeId} />

      <Select
        id="reviewerName"
        name="reviewerName"
        label="Your name"
        required
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
        error={Boolean(state.error)}
      >
        <option value="" disabled>
          Choose…
        </option>
        {reviewerNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={OTHER}>Someone else</option>
      </Select>

      {/* Only rendered once "Someone else" is chosen, so the form stays short
          for the common case. */}
      {choice === OTHER ? (
        <TextField
          id="otherName"
          name="otherName"
          label="Your name"
          autoComplete="off"
          autoFocus
          maxLength={100}
          error={Boolean(state.error)}
        />
      ) : null}

      {askRole ? (
        <div className="flex flex-col gap-1">
          <Select
            id="reviewerRole"
            name="reviewerRole"
            label="What are you looking at this as?"
            value={role}
            onChange={(event) => setRole(event.target.value as ReviewerRole)}
            supportingText={ROLE_HINTS[role]}
          >
            {REVIEWER_ROLES.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {state.error ? (
        <p className="px-4 text-body-small text-error">{state.error}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
