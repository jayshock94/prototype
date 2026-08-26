"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/m3/button";
import { TextField } from "@/components/m3/text-field";
import { login, type LoginState } from "../auth-actions";

function SubmitButton() {
  // useFormStatus reads the state of the form this button sits inside, which is
  // how the button knows to show "Signing in..." while the action runs.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />

      <TextField
        id="password"
        name="password"
        label="Admin password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        error={Boolean(state.error)}
        supportingText={state.error}
      />

      <SubmitButton />
    </form>
  );
}
