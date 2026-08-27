"use client";

/**
 * The finish screen, shared by both review panels.
 *
 * It lives on its own rather than inside the assistant panel because a
 * prototype with no assistant ends a review exactly the same way: show what was
 * captured, then hand over the file. Importing it from the assistant panel
 * would have dragged the whole chat machinery into a page that has no chat.
 */

import { useState } from "react";

import { Button, ButtonLink } from "@/components/m3/button";
import { CheckIcon, DownloadIcon } from "@/components/m3/icons";
import { SeverityBadge } from "@/components/m3/severity-badge";
import { SEVERITIES, summarise, type FeedbackItem } from "@/lib/feedback";

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
export function ReviewSummary({
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
