"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AssistChip } from "@/components/m3/assist-chip";
import { Button, ButtonLink } from "@/components/m3/button";
import { IconButton } from "@/components/m3/icon-button";
import {
  CheckIcon,
  ChevronRightIcon,
  DeleteIcon,
  DownloadIcon,
  ExpandMoreIcon,
  FlagIcon,
  SendIcon,
  SparkIcon,
} from "@/components/m3/icons";
import { SeverityBadge } from "@/components/m3/severity-badge";
import {
  SEVERITIES,
  summarise,
  type FeedbackDraft,
  type FeedbackItem,
} from "@/lib/feedback";
import type { Severity } from "@/db/schema";

import { FeedbackCard } from "./feedback-card";
import { FeedbackForm } from "./feedback-form";

/**
 * Starter questions shown before the reviewer has said anything.
 *
 * These exist because a blank input tells a reviewer nothing about what the
 * assistant knows, and most people will not guess. Each one is a question the
 * assistant can genuinely answer from the context it is given -- the
 * prototype's description, its knowledge base, and the not-built list -- so a
 * reviewer's first attempt gets a useful answer rather than "I don't know".
 *
 * EDIT THESE: they are deliberately generic so they suit any prototype. Keep
 * them short enough to read at a glance, and only add ones the assistant can
 * actually answer.
 */
const STARTER_QUESTIONS = [
  "What is this prototype for?",
  "What should I be checking?",
  "What is not built yet?",
  "Walk me through it",
];

/**
 * One thing in the panel's scrolling area.
 *
 * Messages and recorded feedback share a single ordered list rather than
 * living in separate panes, because they happened in one order and reading
 * them in that order is how a reviewer checks that what they said was
 * understood. A receipt appearing directly under the sentence that produced it
 * needs no explanation; the same receipt in a sidebar does.
 */
export type TimelineEntry =
  | { kind: "message"; id: string; role: "user" | "assistant"; content: string }
  | { kind: "feedback"; id: string; item: FeedbackItem }
  /**
   * A card the assistant has put up that the reviewer has not agreed to.
   * Nothing is in the database yet, so this lives only here: a refresh loses
   * it, which is the correct behaviour -- an unanswered question is not a
   * record of anything.
   */
  | { kind: "draft"; id: string; item: FeedbackDraft };

/**
 * The assistant panel.
 *
 * Collapsible on desktop so the prototype can have the full width; stacked
 * below the prototype and always open on mobile, where there is no room to put
 * it beside anything.
 *
 * There is deliberately no "ask" / "report a problem" mode switch. A reviewer
 * does not know which of the two they are doing until they have said it --
 * "hmm, I expected that to go back to the summary" is both at once -- and
 * making them classify their own thought before typing it is exactly the
 * friction this replaces. They type; the assistant answers, and logs anything
 * that reads as a finding. The receipt it leaves is how they check it got the
 * right end of the stick, and deleting a wrong one is one click. Undo beats
 * asking permission every time.
 */
export function AssistantPanel({
  prototypeId,
  initialTimeline,
  initiallyCompleted,
  configured,
}: {
  prototypeId: string;
  initialTimeline: TimelineEntry[];
  /** True if this reviewer already pressed "finish review" and came back. */
  initiallyCompleted: boolean;
  /** False when ANTHROPIC_API_KEY is missing on the server. */
  configured: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(initialTimeline);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [logging, setLogging] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [busyItems, setBusyItems] = useState<string[]>([]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** The recorded items, in the order they were logged. */
  const recorded = useMemo(
    () =>
      timeline.flatMap((entry) => (entry.kind === "feedback" ? [entry.item] : [])),
    [timeline],
  );

  const hasConversation = timeline.some((entry) => entry.kind === "message");

  // Keep the newest entry in view as it streams in.
  //
  // Skipped while the timeline is empty. On a phone the panel is short and the
  // empty state is taller than it, so scrolling to the bottom on first load
  // put the reviewer halfway down the introduction with its heading cut off.
  useEffect(() => {
    if (timeline.length === 0) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [timeline]);

  function appendText(id: string, chunk: string) {
    setTimeline((prev) =>
      prev.map((entry) =>
        entry.kind === "message" && entry.id === id
          ? { ...entry, content: entry.content + chunk }
          : entry,
      ),
    );
  }

  function replaceText(id: string, content: string) {
    setTimeline((prev) =>
      prev.map((entry) =>
        entry.kind === "message" && entry.id === id ? { ...entry, content } : entry,
      ),
    );
  }

  /*
   * The assistant speaks first.
   *
   * Only into a genuinely empty conversation, and only once per mount. The ref
   * is what stops React's development double-render asking for two greetings,
   * and the server refuses a second one anyway -- but a refused request still
   * puts an empty bubble on screen, so it is worth not making it.
   *
   * A reviewer who reloads mid-review has history, so this does nothing and
   * they come back to the conversation they left.
   */
  const openingAsked = useRef(false);

  useEffect(() => {
    if (openingAsked.current) return;
    if (initialTimeline.length > 0) return;
    openingAsked.current = true;
    void send(undefined, { opening: true });
    // Deliberately runs once on mount. send is recreated every render and
    // depending on it would ask for a greeting after every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(preset?: string, options?: { opening?: boolean }) {
    const opening = options?.opening === true;
    const text = opening ? "" : (preset ?? draft).trim();
    if ((!text && !opening) || sending) return;

    if (!preset && !opening) setDraft("");
    setSending(true);
    setLogging(false);

    const stamp = Date.now();
    let replyId = `local-assistant-${stamp}`;

    // An opening has no reviewer message, so only the assistant's bubble goes
    // up. The reviewer arrives to something already being said to them.
    setTimeline((prev) => [
      ...prev,
      ...(opening
        ? []
        : [
            {
              kind: "message" as const,
              id: `local-user-${stamp}`,
              role: "user" as const,
              content: text,
            },
          ]),
      { kind: "message", id: replyId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prototypeId, message: text, opening }),
      });

      if (!response.ok || !response.body) {
        const problem = await response
          .json()
          .then((d) => d.error as string)
          .catch(() => "Something went wrong.");
        replaceText(replyId, problem);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      /**
       * The stream is newline-delimited JSON, so a chunk can end mid-object.
       * Everything up to the last newline is complete and can be handled; the
       * remainder stays in the buffer until the rest of it arrives.
       */
      function drain(final: boolean) {
        const lines = buffer.split("\n");
        buffer = final ? "" : (lines.pop() ?? "");

        for (const line of lines) {
          if (!line.trim()) continue;

          let event: { t?: string; v?: unknown };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.t === "text" && typeof event.v === "string") {
            appendText(replyId, event.v);
          } else if (event.t === "draft" && event.v) {
            const item = event.v as FeedbackDraft;
            // Show the card where it happened, then continue the reply in a
            // fresh bubble underneath, so anything said after the tool call
            // does not appear above the thing it is talking about.
            const nextId = `local-assistant-${Date.now()}-${item.draftId}`;
            setTimeline((prev) => [
              ...prev,
              { kind: "draft", id: item.draftId, item },
              { kind: "message", id: nextId, role: "assistant", content: "" },
            ]);
            replyId = nextId;
          }
        }
      }

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain(false);
      }
      buffer += decoder.decode();
      drain(true);
    } catch {
      replaceText(
        replyId,
        "The assistant could not be reached. Please try again.",
      );
    } finally {
      // A turn that ended on a tool call leaves an empty bubble behind. Drop
      // any assistant message that never received text rather than showing a
      // permanent "Thinking…".
      setTimeline((prev) =>
        prev.filter(
          (entry) =>
            entry.kind !== "message" ||
            entry.role !== "assistant" ||
            entry.content.length > 0,
        ),
      );
      setSending(false);
      inputRef.current?.focus();
    }
  }

  /** Log an item without going through the assistant. */
  /**
   * Save a draft the assistant proposed.
   *
   * Goes through the same /api/feedback the manual form uses, so a draft that
   * reaches the database has been validated on the way out of the model and
   * again on the way in. On success the draft card is swapped for the saved
   * one in place, so the conversation does not reshuffle under the reviewer.
   */
  async function saveDraft(draftId: string) {
    const entry = timeline.find(
      (e): e is Extract<TimelineEntry, { kind: "draft" }> =>
        e.kind === "draft" && e.id === draftId,
    );
    if (!entry) return;

    setBusyItems((prev) => [...prev, draftId]);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prototypeId,
          screenId: entry.item.screenId,
          happened: entry.item.happened,
          expected: entry.item.expected,
          note: entry.item.note,
          severity: entry.item.severity,
        }),
      });
      if (!response.ok) return;

      const { item } = (await response.json()) as { item: FeedbackItem };
      setTimeline((prev) =>
        prev.map((e) =>
          e.kind === "draft" && e.id === draftId
            ? { kind: "feedback", id: item.id, item }
            : e,
        ),
      );
    } finally {
      setBusyItems((prev) => prev.filter((id) => id !== draftId));
    }
  }

  /** Throw a draft away. Nothing was written, so nothing has to be undone. */
  function discardDraft(draftId: string) {
    setTimeline((prev) =>
      prev.filter((e) => !(e.kind === "draft" && e.id === draftId)),
    );
  }

  /** Change the severity on a draft, before it is saved. */
  function setDraftSeverity(draftId: string, severity: FeedbackDraft["severity"]) {
    setTimeline((prev) =>
      prev.map((e) =>
        e.kind === "draft" && e.id === draftId
          ? { ...e, item: { ...e.item, severity } }
          : e,
      ),
    );
  }

  async function addManually(draftItem: Omit<FeedbackItem, "id">): Promise<boolean> {
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prototypeId, ...draftItem }),
      });
      if (!response.ok) return false;

      const { item } = (await response.json()) as { item: FeedbackItem };
      setTimeline((prev) => [...prev, { kind: "feedback", id: item.id, item }]);
      setListOpen(true);
      return true;
    } catch {
      return false;
    }
  }

  async function changeSeverity(id: string, severity: Severity) {
    const previous = recorded.find((i) => i.id === id)?.severity;

    // Optimistic: a severity is a two-click correction and waiting on a round
    // trip to see it take makes the control feel broken.
    setTimeline((prev) =>
      prev.map((entry) =>
        entry.kind === "feedback" && entry.id === id
          ? { ...entry, item: { ...entry.item, severity } }
          : entry,
      ),
    );

    const response = await fetch(
      `/api/feedback/${id}?prototypeId=${prototypeId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity }),
      },
    ).catch(() => null);

    if ((!response || !response.ok) && previous) {
      setTimeline((prev) =>
        prev.map((entry) =>
          entry.kind === "feedback" && entry.id === id
            ? { ...entry, item: { ...entry.item, severity: previous } }
            : entry,
        ),
      );
    }
  }

  async function remove(id: string) {
    setBusyItems((prev) => [...prev, id]);

    const response = await fetch(
      `/api/feedback/${id}?prototypeId=${prototypeId}`,
      { method: "DELETE" },
    ).catch(() => null);

    // A 404 means it is already gone, which is the state we were aiming for.
    if (response && (response.ok || response.status === 404)) {
      setTimeline((prev) =>
        prev.filter((entry) => !(entry.kind === "feedback" && entry.id === id)),
      );
    }

    setBusyItems((prev) => prev.filter((x) => x !== id));
  }

  async function setFinished(finished: boolean) {
    setCompleted(finished);
    await fetch(`/api/review/finish?prototypeId=${prototypeId}`, {
      method: finished ? "POST" : "DELETE",
    }).catch(() => {
      // Reverting would hide a failure the reviewer can do nothing about. The
      // feedback itself is already saved, which is the part that matters.
    });
  }

  return (
    <aside
      className={[
        "flex shrink-0 flex-col border-outline-variant bg-surface-container-low",
        "max-lg:w-full max-lg:border-t",
        "lg:h-full lg:border-l",
        open ? "lg:w-[clamp(20rem,32%,28rem)]" : "lg:w-14",
        "transition-[width] duration-[--md-sys-motion-duration-medium] ease-emphasized",
      ].join(" ")}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-outline-variant px-3">
        {open ? (
          <>
            <span className="text-primary">
              <SparkIcon className="size-5" />
            </span>
            <h2 className="flex-1 text-title-medium text-on-surface">Assistant</h2>
          </>
        ) : null}

        <IconButton
          aria-label={open ? "Collapse assistant panel" : "Expand assistant panel"}
          onClick={() => setOpen((v) => !v)}
          className="max-lg:hidden"
        >
          <ChevronRightIcon
            className={[
              "size-6 transition-transform duration-[--md-sys-motion-duration-medium] ease-emphasized",
              open ? "" : "rotate-180",
            ].join(" ")}
          />
        </IconButton>
      </div>

      {open ? (
        completed ? (
          <ReviewSummary
            prototypeId={prototypeId}
            items={recorded}
            onReopen={() => void setFinished(false)}
          />
        ) : (
          <>
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-4 py-4 max-lg:max-h-[45dvh]"
            >
              {!hasConversation && recorded.length === 0 ? (
                <EmptyState
                  configured={configured}
                  sending={sending}
                  onAsk={(q) => void send(q)}
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {timeline.map((entry) =>
                    entry.kind === "draft" ? (
                      <li key={entry.id}>
                        <p className="mb-1 flex items-center gap-1 text-label-medium text-primary">
                          <FlagIcon className="size-4" />
                          Is this right?
                        </p>
                        <FeedbackCard
                          item={{ ...entry.item, id: undefined }}
                          busy={busyItems.includes(entry.id)}
                          onSeverityChange={(sev) => setDraftSeverity(entry.id, sev)}
                          onDelete={() => discardDraft(entry.id)}
                          onSave={() => void saveDraft(entry.id)}
                        />
                      </li>
                    ) : entry.kind === "feedback" ? (
                      <li key={entry.id}>
                        <p className="mb-1 flex items-center gap-1 text-label-medium text-tertiary">
                          <CheckIcon className="size-4" />
                          Saved
                        </p>
                        <FeedbackCard
                          item={entry.item}
                          busy={busyItems.includes(entry.id)}
                          onSeverityChange={(s) => void changeSeverity(entry.id, s)}
                          onDelete={() => void remove(entry.id)}
                        />
                      </li>
                    ) : (
                      <li
                        key={entry.id}
                        className={entry.role === "user" ? "flex justify-end" : "flex"}
                      >
                        <div
                          className={[
                            "max-w-[85%] rounded-lg px-4 py-2 text-body-medium whitespace-pre-wrap",
                            entry.role === "user"
                              ? "bg-primary-container text-on-primary-container"
                              : "bg-surface-container-highest text-on-surface",
                          ].join(" ")}
                        >
                          {entry.content || (
                            <span className="text-on-surface-variant">Thinking…</span>
                          )}
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>

            <LoggedStrip
              items={recorded}
              expanded={listOpen}
              busyItems={busyItems}
              onToggle={() => setListOpen((v) => !v)}
              onDelete={(id) => void remove(id)}
              onFinish={() => void setFinished(true)}
            />

            <div className="shrink-0 border-t border-outline-variant p-3">
              {logging ? (
                <FeedbackForm
                  onSubmit={addManually}
                  onCancel={() => setLogging(false)}
                />
              ) : (
                <div className="flex items-end gap-2">
                  <IconButton
                    aria-label="Log feedback without asking the assistant"
                    title="Log feedback yourself"
                    onClick={() => setLogging(true)}
                    className="text-on-surface-variant"
                  >
                    <FlagIcon className="size-5" />
                  </IconButton>

                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends; Shift+Enter is a newline, as in every chat app.
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={1}
                    disabled={!configured}
                    placeholder="Ask, or say what is wrong…"
                    aria-label="Message the assistant"
                    className={[
                      "max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-outline px-4 py-2.5",
                      "bg-transparent text-body-medium text-on-surface",
                      "placeholder:text-on-surface-variant",
                      "focus:border-primary focus:outline-none",
                      "disabled:cursor-not-allowed disabled:text-on-surface/38",
                    ].join(" ")}
                  />

                  <IconButton
                    aria-label="Send message"
                    onClick={() => void send()}
                    disabled={!configured || sending || !draft.trim()}
                    className="bg-primary text-on-primary disabled:bg-on-surface/12"
                  >
                    <SendIcon className="size-5" />
                  </IconButton>
                </div>
              )}
            </div>
          </>
        )
      ) : null}
    </aside>
  );
}

/**
 * What the panel says before anything has happened.
 *
 * Two jobs: say what the assistant knows, and say that describing a problem is
 * enough to record it. The second is the part reviewers do not expect -- every
 * other feedback tool they have used made them fill something in -- so it is
 * stated outright rather than left to be discovered.
 */
function EmptyState({
  configured,
  sending,
  onAsk,
}: {
  configured: boolean;
  sending: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5 px-1 py-2">
      {!configured ? (
        <p className="rounded-md bg-error-container px-4 py-3 text-body-small text-on-error-container">
          The assistant is not set up on the server yet, so you cannot ask it
          anything. You can still log feedback yourself with the flag button
          below.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {/* Icon and title centred; the paragraph is not. Centred body text is
            hard to read at this width, and left-aligning it also lines it up
            with the chips below. */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <SparkIcon />
          </span>
          <p className="text-title-small text-on-surface">
            Ask, or just say what is wrong
          </p>
        </div>
        <p className="text-body-small text-on-surface-variant">
          It has been briefed on what this prototype is meant to do — what
          things are for, what is in scope, and what has deliberately been left
          out. Ask as you click around.
        </p>
        <p className="text-body-small text-on-surface-variant">
          <strong className="text-on-surface">
            You do not have to fill anything in.
          </strong>{" "}
          Describe a problem the way you would say it out loud and it gets
          logged for the designer, with a receipt here you can correct or
          delete.
        </p>
      </div>

      {configured ? (
        <div className="flex flex-col gap-2">
          <p className="text-label-medium text-on-surface-variant">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {STARTER_QUESTIONS.map((question) => (
              <AssistChip
                key={question}
                disabled={sending}
                onClick={() => onAsk(question)}
              >
                {question}
              </AssistChip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Said plainly, because a reviewer who assumes it can see the screen
          will ask "what does this button do?" and get a confusing answer.
          Chunk 6 removes this limitation. */}
      <p className="rounded-md bg-surface-container-highest px-3 py-2 text-body-small text-on-surface-variant">
        It cannot see your screen yet, so name the screen or button you mean.
      </p>
    </div>
  );
}

/**
 * The running count, sitting between the conversation and the composer.
 *
 * Collapsed it is one row, because a panel this narrow cannot afford a
 * permanent list and the receipts in the conversation already show each item as
 * it lands. What the row is for is the question a reviewer asks near the end --
 * "did it actually get all of that?" -- which the transcript answers only by
 * scrolling.
 *
 * Expanded it is one line per item, not a second copy of the cards. Repeating
 * the full card here put the same item on screen twice whenever the
 * conversation was short, which reads as a bug rather than a summary. A line
 * each is a checklist: enough to recognise what is there, and to remove
 * anything that should not be.
 */
function LoggedStrip({
  items,
  expanded,
  busyItems,
  onToggle,
  onDelete,
  onFinish,
}: {
  items: FeedbackItem[];
  expanded: boolean;
  busyItems: string[];
  onToggle: () => void;
  onDelete: (id: string) => void;
  onFinish: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-outline-variant bg-surface-container">
      {expanded && items.length > 0 ? (
        <ul className="flex max-h-56 flex-col divide-y divide-outline-variant overflow-y-auto border-b border-outline-variant">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 px-3 py-1.5"
            >
              <SeverityBadge severity={item.severity} />
              <span className="min-w-0 flex-1 truncate text-body-small text-on-surface">
                {summarise(item)}
              </span>
              {item.screenId ? (
                <span className="shrink-0 text-label-small text-on-surface-variant">
                  {item.screenId}
                </span>
              ) : null}
              <IconButton
                aria-label="Delete this feedback"
                onClick={() => onDelete(item.id)}
                disabled={busyItems.includes(item.id)}
                className="size-8 shrink-0 text-on-surface-variant"
              >
                <DeleteIcon className="size-[18px]" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={items.length === 0}
          aria-expanded={expanded}
          className={[
            "m3-state-layer flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-2 py-1",
            "text-label-large text-on-surface",
            "disabled:pointer-events-none disabled:text-on-surface-variant",
          ].join(" ")}
        >
          <ExpandMoreIcon
            className={[
              "size-5 shrink-0 transition-transform duration-[--md-sys-motion-duration-short] ease-standard",
              expanded ? "rotate-180" : "",
              items.length === 0 ? "opacity-0" : "",
            ].join(" ")}
          />
          {items.length === 0
            ? "Nothing logged yet"
            : `${items.length} logged`}
        </button>

        <Button variant="text" onClick={onFinish} className="shrink-0">
          Finish review
        </Button>
      </div>
    </div>
  );
}

/**
 * What the reviewer sees after pressing finish.
 *
 * Two jobs. First, show them what was captured, because if it does not match
 * what they think they said this is the moment they will notice -- which is
 * why reopening is offered rather than treating finish as a one-way door.
 *
 * Second, hand them the file. A reviewer who screenshots things on their own
 * has to write the description, remember what they expected, and organise it
 * before sending anything; the download is the same work already done. It has
 * to be the loudest thing on this screen or they will fall back to the habit
 * it replaces.
 */
function ReviewSummary({
  prototypeId,
  items,
  onReopen,
}: {
  prototypeId: string;
  items: FeedbackItem[];
  onReopen: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const counts = SEVERITIES.map((severity) => ({
    severity,
    count: items.filter((i) => i.severity === severity).length,
  })).filter((row) => row.count > 0);

  /**
   * Copy the same report as plain text.
   *
   * The archive is for attaching; this is for the other half of how things
   * actually get sent -- pasted into a ticket or a chat window, where an
   * attachment is one click too many and often goes unopened.
   */
  async function copyAsText() {
    setCopyFailed(false);
    try {
      const response = await fetch(
        `/api/review/export?prototypeId=${prototypeId}&format=md`,
      );
      if (!response.ok) throw new Error("export failed");
      await navigator.clipboard.writeText(await response.text());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access is refused outright in some browsers and locked-down
      // corporate profiles. Say so rather than looking like nothing happened
      // -- the download is right above and still works.
      setCopyFailed(true);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 max-lg:max-h-[45dvh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <CheckIcon />
          </span>
          <p className="text-title-medium text-on-surface">Review finished</p>
          <p className="text-body-small text-on-surface-variant">
            {items.length === 0
              ? "You did not log anything. That is a result too — it means nothing got in your way."
              : `${items.length} ${items.length === 1 ? "finding is" : "findings are"} saved. Download a copy to send on however you like.`}
          </p>
        </div>

        {items.length > 0 ? (
          <div className="mt-5 flex flex-col gap-2">
            <ButtonLink
              href={`/api/review/export?prototypeId=${prototypeId}`}
              variant="filled"
              fullWidth
              icon={<DownloadIcon className="size-[18px]" />}
            >
              Download my feedback
            </ButtonLink>

            <Button variant="text" fullWidth onClick={() => void copyAsText()}>
              {copied ? "Copied" : "Copy as text instead"}
            </Button>

            {copyFailed ? (
              <p className="text-body-small text-error" role="alert">
                Your browser would not let us reach the clipboard. Use the
                download above.
              </p>
            ) : null}

            {/* Said plainly, because "what is in this file and what do I do
                with it" is the question that decides whether they send it or
                go back to taking screenshots. */}
            <p className="mt-1 text-body-small text-on-surface-variant">
              A zip with two files: one opens in a browser and prints to PDF,
              the other pastes into a ticket or a message. Both carry every
              finding plus the whole conversation.
            </p>
          </div>
        ) : null}

        {counts.length > 0 ? (
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {counts.map(({ severity, count }) => (
              <li key={severity}>
                <SeverityBadge severity={severity} />
                <span className="ml-1 text-label-medium text-on-surface-variant">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {items.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-md bg-surface-container px-3 py-2"
              >
                <SeverityBadge severity={item.severity} className="mt-0.5" />
                <span className="min-w-0 text-body-small text-on-surface">
                  {summarise(item)}
                  {item.screenId ? (
                    <span className="text-on-surface-variant">
                      {" "}
                      — {item.screenId}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-outline-variant p-3">
        <Button variant="outlined" fullWidth onClick={onReopen}>
          I have more to add
        </Button>
      </div>
    </div>
  );
}
