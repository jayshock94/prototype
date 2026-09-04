"use client";

/**
 * Deleting a prototype, and being sure about it.
 *
 * The pattern is the familiar one -- say exactly what will be destroyed, then
 * make somebody type the name -- and it is here for the ordinary reason: this
 * is the one action in the admin area with nothing behind it. There is no bin,
 * no undo, and no copy of a reviewer's conversation anywhere else.
 *
 * The counts are the important half. "This cannot be undone" is a sentence
 * everybody has learned to click past; "3 reviews and 14 findings" is a fact
 * that stops the hand. They are rendered even when they are zero, because a
 * prototype nobody has reviewed is exactly the one it is safe to delete and
 * saying so is worth more than hiding the line.
 *
 * The typed name is checked again in the action. A disabled button is a
 * courtesy to the person, not a control on the request.
 */

import { useActionState, useState } from "react";

import { Button } from "@/components/m3/button";
import { DeleteIcon } from "@/components/m3/icons";
import { TextField } from "@/components/m3/text-field";

import { deletePrototype, type DeletePrototypeState } from "./actions";

export interface DeletionTally {
  versions: number;
  reviews: number;
  findings: number;
  screenshots: number;
}

export function DeletePrototype({
  prototypeId,
  name,
  tally,
}: {
  prototypeId: string;
  name: string;
  tally: DeletionTally;
}) {
  const [armed, setArmed] = useState(false);
  const [typed, setTyped] = useState("");

  const action = deletePrototype.bind(null, prototypeId);
  const [state, formAction, pending] = useActionState<DeletePrototypeState, FormData>(
    action,
    {},
  );

  const matches = typed.trim() === name.trim();

  const going = [
    `${tally.versions} ${tally.versions === 1 ? "version" : "versions"} of the prototype file`,
    `${tally.reviews} ${tally.reviews === 1 ? "review" : "reviews"}, with the conversations`,
    `${tally.findings} ${tally.findings === 1 ? "finding" : "findings"}`,
    `${tally.screenshots} ${tally.screenshots === 1 ? "screenshot" : "screenshots"}`,
  ];

  return (
    <section className="rounded-lg border border-error/40 p-5">
      <h2 className="text-title-medium text-error">Delete this prototype</h2>
      <p className="mt-1 text-body-medium text-on-surface-variant">
        Permanent. The reviewer link stops working immediately and nothing here
        can be recovered.
      </p>

      <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-body-medium text-on-surface-variant">
        {going.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {!armed ? (
        <div className="mt-4">
          <Button
            variant="outlined"
            onClick={() => setArmed(true)}
            icon={<DeleteIcon className="size-[18px]" />}
            className="border-error text-error"
          >
            Delete prototype
          </Button>
        </div>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <TextField
            id="confirmName"
            name="confirmName"
            label="Type the name to confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            supportingText={name}
          />

          {state.error ? (
            <p className="text-body-small text-error" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              variant="filled"
              disabled={!matches || pending}
              icon={<DeleteIcon className="size-[18px]" />}
              className="bg-error text-on-error"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>

            <Button
              type="button"
              variant="text"
              disabled={pending}
              onClick={() => {
                setArmed(false);
                setTyped("");
              }}
            >
              Keep it
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
