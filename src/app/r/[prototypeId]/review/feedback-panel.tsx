"use client";

/**
 * The panel for a prototype with no assistant.
 *
 * Same job as the assistant panel, none of the conversation: show the reviewer
 * what this review is about, take their feedback on a form, and hand them the
 * file at the end. Nothing here calls Anthropic, so a prototype in this mode
 * costs nothing to review and cannot be affected by an outage.
 *
 * It is deliberately a brief followed by a form, in that order. A feedback box
 * on its own gets "looks good" -- the scenario and the tasks are what give
 * somebody something specific to react to, and they are the reason this is
 * worth more than an email asking for thoughts.
 *
 * The finish screen is the same component the assistant panel uses, because a
 * review ends the same way whether or not anyone was talking.
 */

import { useState } from "react";

import { Button } from "@/components/m3/button";
import { IconButton } from "@/components/m3/icon-button";
import { AddIcon, FlagIcon } from "@/components/m3/icons";
import { SeverityBadge } from "@/components/m3/severity-badge";
import { DeleteIcon } from "@/components/m3/icons";
import { summarise, type FeedbackItem } from "@/lib/feedback";
import { FeedbackForm } from "./feedback-form";
import { ReviewSummary } from "./review-summary";

export interface BriefTask {
  goal: string;
  successState: string | null;
}

export interface BriefCriterion {
  ref: string | null;
  text: string;
  verifiableInPrototype: boolean;
}

export function FeedbackPanel({
  prototypeId,
  scenario,
  tasks,
  criteria,
  notBuilt,
  initialItems,
  initiallyCompleted,
}: {
  prototypeId: string;
  scenario: string | null;
  tasks: BriefTask[];
  criteria: BriefCriterion[];
  notBuilt: string[];
  initialItems: FeedbackItem[];
  initiallyCompleted: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string[]>([]);
  const [completed, setCompleted] = useState(initiallyCompleted);

  async function add(draft: Omit<FeedbackItem, "id">): Promise<boolean> {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prototypeId, ...draft }),
    }).catch(() => null);

    if (!response?.ok) return false;

    const { item } = (await response.json()) as { item: FeedbackItem };
    setItems((prev) => [...prev, item]);
    setAdding(false);
    return true;
  }

  async function remove(id: string) {
    setBusy((prev) => [...prev, id]);
    const response = await fetch(
      `/api/feedback/${id}?prototypeId=${prototypeId}`,
      { method: "DELETE" },
    ).catch(() => null);

    // A 404 means it is already gone, which is the state we were after.
    if (response && (response.ok || response.status === 404)) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
    setBusy((prev) => prev.filter((x) => x !== id));
  }

  async function setFinished(finished: boolean) {
    setCompleted(finished);
    await fetch(`/api/review/finish?prototypeId=${prototypeId}`, {
      method: finished ? "POST" : "DELETE",
    }).catch(() => {
      // Reverting would hide a failure the reviewer can do nothing about, and
      // the feedback itself is already saved, which is the part that matters.
    });
  }

  return (
    <aside
      className={[
        "flex shrink-0 flex-col border-outline-variant bg-surface-container-low",
        "max-lg:w-full max-lg:border-t",
        "lg:h-full lg:w-[clamp(20rem,32%,28rem)] lg:border-l",
      ].join(" ")}
    >
      <header className="flex items-center gap-2 border-b border-outline-variant px-4 py-3">
        <span className="text-on-surface-variant">
          <FlagIcon className="size-5" />
        </span>
        <h2 className="text-title-medium text-on-surface">Your feedback</h2>
      </header>

      {completed ? (
        <ReviewSummary
          prototypeId={prototypeId}
          items={items}
          onReopen={() => void setFinished(false)}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 max-lg:max-h-[45dvh]">
            <div className="flex flex-col gap-6">
              <Brief
                scenario={scenario}
                tasks={tasks}
                criteria={criteria}
                notBuilt={notBuilt}
              />

              <section className="flex flex-col gap-3">
                <h3 className="text-title-small text-on-surface">
                  {items.length === 0
                    ? "Nothing logged yet"
                    : `${items.length} logged`}
                </h3>

                {items.length === 0 && !adding ? (
                  <p className="text-body-medium text-on-surface-variant">
                    Anything that surprised you, anything missing, anything you
                    would change. Small things count.
                  </p>
                ) : null}

                {items.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 rounded-sm bg-surface-container px-3 py-2"
                      >
                        <SeverityBadge severity={item.severity} />
                        <p className="min-w-0 flex-1 text-body-medium text-on-surface">
                          {summarise(item)}
                        </p>
                        <IconButton
                          aria-label="Delete this feedback"
                          onClick={() => void remove(item.id)}
                          disabled={busy.includes(item.id)}
                          className="-mt-1 size-8 shrink-0 text-on-surface-variant"
                        >
                          <DeleteIcon className="size-[18px]" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {adding ? (
                  <FeedbackForm onSubmit={add} onCancel={() => setAdding(false)} />
                ) : (
                  <div>
                    <Button
                      variant="tonal"
                      onClick={() => setAdding(true)}
                      icon={<AddIcon className="size-[18px]" />}
                    >
                      Add feedback
                    </Button>
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-outline-variant px-3 py-2">
            <Button variant="text" onClick={() => void setFinished(true)}>
              Finish review
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}

/**
 * What this review is about, read-only.
 *
 * Every section disappears when it is empty rather than showing a heading with
 * nothing under it, so a prototype briefed with only a scenario is a short
 * panel rather than a mostly-blank one.
 *
 * The not-built list is here for the reviewer's sake, not for completeness. In
 * a review with an assistant it answers "is that broken or is it just not
 * finished?" as the question comes up; with no assistant to ask, saying it up
 * front is what stops somebody spending their attention on a button that was
 * never going to work.
 */
function Brief({
  scenario,
  tasks,
  criteria,
  notBuilt,
}: {
  scenario: string | null;
  tasks: BriefTask[];
  criteria: BriefCriterion[];
  notBuilt: string[];
}) {
  const empty =
    !scenario && tasks.length === 0 && criteria.length === 0 && notBuilt.length === 0;
  if (empty) return null;

  return (
    <div className="flex flex-col gap-5">
      {scenario ? (
        <section className="rounded-sm bg-surface-container p-3">
          <h3 className="text-label-medium text-on-surface-variant">The situation</h3>
          <p className="mt-1 text-body-medium whitespace-pre-line text-on-surface">
            {scenario}
          </p>
        </section>
      ) : null}

      {tasks.length > 0 ? (
        <section>
          <h3 className="text-title-small text-on-surface">Things to try</h3>
          <ol className="mt-2 flex flex-col gap-2">
            {tasks.map((task, index) => (
              <li key={index} className="flex gap-2 text-body-medium">
                <span className="shrink-0 text-on-surface-variant tabular-nums">
                  {index + 1}.
                </span>
                <span className="min-w-0">
                  <span className="text-on-surface">{task.goal}</span>
                  {task.successState ? (
                    <span className="block text-body-small text-on-surface-variant">
                      Done when: {task.successState}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {criteria.length > 0 ? (
        <section>
          <h3 className="text-title-small text-on-surface">What it is meant to do</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {criteria.map((criterion, index) => (
              <li key={index} className="text-body-medium text-on-surface">
                {criterion.ref ? (
                  <span className="text-on-surface-variant">{criterion.ref}: </span>
                ) : null}
                {criterion.text}
                {!criterion.verifiableInPrototype ? (
                  <span className="block text-body-small text-on-surface-variant">
                    Cannot be checked here
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notBuilt.length > 0 ? (
        <section>
          <h3 className="text-title-small text-on-surface">Not built yet</h3>
          <p className="mt-1 text-body-small text-on-surface-variant">
            Deliberately missing, so do not spend time on these.
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {notBuilt.map((text, index) => (
              <li key={index} className="text-body-medium text-on-surface-variant">
                {text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
