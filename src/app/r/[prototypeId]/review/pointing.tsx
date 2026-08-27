"use client";

/**
 * The small pieces of "point at something", shared by both panels.
 *
 * A prototype with an assistant and one without capture references the same
 * way, so the button, the pending card and the thumbnail live here rather than
 * being written twice and drifting apart.
 */

import { IconButton } from "@/components/m3/icon-button";
import { CloseIcon, ImageIcon, PointAtIcon } from "@/components/m3/icons";
import type { AnnotationRef } from "@/lib/annotation";
import { describeRef } from "@/lib/annotation";

import type { Eyes } from "./review-workspace";

/**
 * The button that starts pointing.
 *
 * It lives beside the composer rather than over the prototype, because the
 * prototype is somebody's design and putting our controls on top of it is both
 * rude and confusing -- a reviewer should never have to work out whether a
 * button belongs to the thing they are reviewing.
 */
export function PointAtButton({ eyes }: { eyes: Eyes }) {
  return (
    <IconButton
      aria-label={
        eyes.picking
          ? "Stop pointing at something"
          : "Point at something in the prototype"
      }
      title="Point at something in the prototype"
      aria-pressed={eyes.picking}
      disabled={eyes.capturing}
      onClick={() => (eyes.picking ? eyes.cancelPicking() : eyes.startPicking())}
      className={
        eyes.picking
          ? "bg-primary text-on-primary"
          : "text-on-surface-variant"
      }
    >
      <PointAtIcon className="size-5" />
    </IconButton>
  );
}

/**
 * The reference waiting to be attached, and anything that went wrong getting
 * one.
 *
 * It says in words that it is not attached to anything yet, because a picture
 * sitting in the panel looks like something that has been saved. The rule from
 * the personality file holds here too: a thing that has not been kept must
 * never look like a thing that has.
 */
export function PendingReference({ eyes }: { eyes: Eyes }) {
  if (eyes.problem) {
    return (
      <div className="border-t border-outline-variant px-3 py-2">
        <p className="text-body-small text-error" role="alert">
          {eyes.problem} You can still say what is wrong in words.
        </p>
      </div>
    );
  }

  if (!eyes.reference) return null;

  return (
    <div className="border-t border-outline-variant bg-surface-container px-3 py-2">
      <div className="flex items-center gap-3">
        <Thumbnail reference={eyes.reference} className="size-14 shrink-0 object-cover" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-label-large text-on-surface">
            {describeRef(eyes.reference)}
          </p>
          <p className="text-body-small text-on-surface-variant">
            Goes with the next thing you save
          </p>
        </div>

        <IconButton
          aria-label="Remove this reference"
          onClick={eyes.clearReference}
          className="shrink-0 text-on-surface-variant"
        >
          <CloseIcon className="size-5" />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * A picture of what was pointed at.
 *
 * Fetched from /api/annotation/[id]/image rather than from Blob directly --
 * screenshots are stored privately and that route is where the check on who is
 * asking lives. A reference whose picture never made it still renders, as a
 * placeholder: the words are the useful half and losing them because an image
 * is missing would be the wrong way round.
 */
export function Thumbnail({
  reference,
  className = "size-12",
}: {
  reference: AnnotationRef;
  className?: string;
}) {
  if (!reference.imageUrl) {
    return (
      <span
        className={`flex items-center justify-center rounded-xs bg-surface-container-highest text-on-surface-variant ${className}`}
      >
        <ImageIcon className="size-5" />
      </span>
    );
  }

  /*
   * A plain <img>, not next/image. The optimiser fetches and caches by URL,
   * and these URLs are answered differently depending on who is asking -- a
   * cached copy of one reviewer's screenshot handed to the next reviewer is
   * exactly the thing the route below it exists to prevent.
   */
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={reference.imageUrl}
      alt={describeRef(reference)}
      className={`rounded-xs border border-outline-variant bg-surface ${className}`}
    />
  );
}
