"use client";

import { useState } from "react";

import { IconButton } from "@/components/m3/icon-button";
import { ChevronRightIcon, SparkIcon } from "@/components/m3/icons";

/**
 * Placeholder for the assistant, which arrives in chunk 4.
 *
 * It exists now to hold the space, so the review layout does not have to be
 * rebuilt around it later, and so the width the assistant will occupy is
 * settled while it is cheap to change.
 *
 * Collapsible on desktop: the reviewer can fold it away to give the prototype
 * the full width, which matters on a laptop. On mobile it sits below the
 * prototype and is always open -- there is no room to put it beside anything.
 */
export function AssistantPanel() {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={[
        "flex shrink-0 flex-col border-outline-variant bg-surface-container-low",
        "max-lg:w-full max-lg:border-t",
        "lg:h-full lg:border-l",
        // Collapsed, only the reopen button remains.
        open ? "lg:w-[clamp(20rem,32%,28rem)]" : "lg:w-14",
        "transition-[width] duration-[--md-sys-motion-duration-medium] ease-emphasized",
      ].join(" ")}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        {open ? (
          <>
            <span className="text-primary">
              <SparkIcon className="size-5" />
            </span>
            <h2 className="flex-1 text-title-medium text-on-surface">Assistant</h2>
          </>
        ) : null}

        {/* Collapsing is a desktop affordance; on mobile the panel is stacked
            and there is nothing to collapse into. */}
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center max-lg:py-12">
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
            <SparkIcon />
          </span>
          <p className="text-title-small text-on-surface">Assistant coming soon</p>
          <p className="text-body-small text-on-surface-variant">
            You will be able to ask questions about this prototype here, and
            anything you flag will be captured as feedback automatically.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
