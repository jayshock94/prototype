"use client";

import { useState, type CSSProperties } from "react";

import { Button } from "@/components/m3/button";
import { Select } from "@/components/m3/select";
import { TextArea } from "@/components/m3/text-area";
import { TextField } from "@/components/m3/text-field";
import {
  SEVERITIES,
  SEVERITY_DESCRIPTIONS,
  SEVERITY_LABELS,
  type FeedbackItem,
} from "@/lib/feedback";
import type { Severity } from "@/db/schema";

/**
 * Logging feedback without talking to the assistant.
 *
 * The conversation is the main path and this is the escape hatch, kept for two
 * cases the conversation does not serve. Some reviewers would simply rather
 * fill in a form than chat about a typo. And when the assistant is unavailable
 * -- no API key, Anthropic having a bad afternoon -- feedback still has to be
 * capturable, because losing a reviewing session to a third party's outage is
 * not acceptable.
 *
 * Deliberately short. "Note" exists on the row but is not on this form: in a
 * form a reviewer puts everything in the first box anyway, and a fifth field in
 * a panel this narrow costs more than it collects. The assistant still fills it
 * when the conversation gives it something worth keeping.
 */
export function FeedbackForm({
  onSubmit,
  onCancel,
  screenId: detected,
}: {
  onSubmit: (draft: Omit<FeedbackItem, "id">) => Promise<boolean>;
  onCancel: () => void;
  /**
   * The screen showing in the prototype right now, when it says which one it
   * is. Filled in rather than asked for: a reviewer typing the name of the
   * screen they are looking at is work the page can do for them, and the
   * field stays editable because a marked-up prototype can still be wrong
   * about which of its screens is on top.
   */
  screenId?: string | null;
}) {
  const [happened, setHappened] = useState("");
  const [expected, setExpected] = useState("");
  const [screenId, setScreenId] = useState(detected ?? "");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    if (saving) return;

    // The server enforces this too. Checking here as well means the reviewer
    // finds out before the round trip, rather than watching an empty form
    // bounce back.
    if (!happened.trim() && !expected.trim()) {
      setProblem("Say what is wrong, or what you expected instead.");
      return;
    }

    setSaving(true);
    setProblem(null);

    const ok = await onSubmit({
      happened: happened.trim() || null,
      expected: expected.trim() || null,
      screenId: screenId.trim() || null,
      note: null,
      severity,
    });

    setSaving(false);
    if (ok) onCancel();
    else setProblem("That could not be saved. Please try again.");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container p-3"
      /* This wrapper sets its own surface, so the notch a floating label paints
         over the field outline has to be told to match it. CLAUDE.md: any
         hand-rolled container holding a text field must say this. */
      style={
        { "--m3-field-surface": "var(--md-sys-color-surface-container)" } as CSSProperties
      }
    >
      <p className="text-title-small text-on-surface">Log feedback</p>

      <TextArea
        id="fb-happened"
        label="What is wrong?"
        rows={2}
        value={happened}
        onChange={(e) => setHappened(e.target.value)}
      />

      <TextArea
        id="fb-expected"
        label="What did you expect?"
        rows={2}
        value={expected}
        onChange={(e) => setExpected(e.target.value)}
      />

      <TextField
        id="fb-screen"
        label="Which screen"
        value={screenId}
        onChange={(e) => setScreenId(e.target.value)}
      />

      <Select
        id="fb-severity"
        label="How serious"
        value={severity}
        supportingText={SEVERITY_DESCRIPTIONS[severity]}
        onChange={(e) => setSeverity(e.target.value as Severity)}
      >
        {SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {SEVERITY_LABELS[s]}
          </option>
        ))}
      </Select>

      {problem ? (
        <p className="text-body-small text-error" role="alert">
          {problem}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="text" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="filled" disabled={saving}>
          {saving ? "Saving…" : "Log it"}
        </Button>
      </div>
    </form>
  );
}
