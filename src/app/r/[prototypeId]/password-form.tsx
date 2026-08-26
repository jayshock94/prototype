"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/m3/button";
import { TextField } from "@/components/m3/text-field";
import { enterPassword, type PasswordState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? "Checking…" : "Continue"}
    </Button>
  );
}

export function PasswordForm({ prototypeId }: { prototypeId: string }) {
  const [state, formAction] = useActionState<PasswordState, FormData>(enterPassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="prototypeId" value={prototypeId} />
      <TextField
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="off"
        autoFocus
        required
        error={Boolean(state.error)}
        supportingText={state.error}
      />
      <SubmitButton />
    </form>
  );
}
