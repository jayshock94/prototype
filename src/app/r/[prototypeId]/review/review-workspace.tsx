"use client";

/**
 * The prototype and the panel beside it, as one component.
 *
 * They used to be two siblings in a server component, which was right until the
 * panel needed to know what was happening inside the frame. Now one client
 * component owns both: it holds the iframe, watches what the reviewer is doing
 * in it, and hands the panel the answers.
 *
 * Everything it knows comes from reading `iframe.contentDocument`, which is
 * only possible because /p/[versionId] serves the prototype from our own
 * origin. That is the constraint in CLAUDE.md, and this file is what it was
 * for.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { CloseIcon } from "@/components/m3/icons";
import type { AnnotationRef } from "@/lib/annotation";
import { captureElement } from "@/lib/element-capture";
import type { FeedbackItem } from "@/lib/feedback";
import {
  cssPath,
  describeElement,
  pathDigest,
  visitCount,
  watchPrototype,
  type PathStep,
} from "@/lib/prototype-eyes";

import { AssistantPanel, type TimelineEntry } from "./assistant-panel";
import {
  FeedbackPanel,
  type BriefCriterion,
  type BriefTask,
} from "./feedback-panel";

/**
 * What the panel knows about where the reviewer is, in a shape both panels and
 * the chat route can use.
 */
export interface PointerContext {
  /** The screen showing right now, when the prototype says which one it is. */
  screen: string | null;
  /** The last few things they did, already worded for reading. */
  path: string;
  /** The reference waiting to be attached to whatever they save next. */
  reference: AnnotationRef | null;
}

/** Everything the panels need in order to offer "point at something". */
export interface Eyes {
  screen: string | null;
  reference: AnnotationRef | null;
  picking: boolean;
  capturing: boolean;
  /** Something went wrong taking or storing the picture. */
  problem: string | null;
  startPicking: () => void;
  cancelPicking: () => void;
  /** Throw the pending reference away without saving anything. */
  clearReference: () => void;
  /** Called after a save that used the reference, so it is not used twice. */
  useReference: () => void;
  context: () => PointerContext;
}

export function ReviewWorkspace({
  prototypeId,
  versionId,
  frameTitle,
  assistantOff,
  scenario,
  tasks,
  criteria,
  notBuilt,
  items,
  timeline,
  completed,
  configured,
}: {
  prototypeId: string;
  versionId: string;
  frameTitle: string;
  assistantOff: boolean;
  scenario: string | null;
  tasks: BriefTask[];
  criteria: BriefCriterion[];
  notBuilt: string[];
  items: FeedbackItem[];
  timeline: TimelineEntry[];
  completed: boolean;
  configured: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [screen, setScreen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [reference, setReference] = useState<AnnotationRef | null>(null);
  const [highlight, setHighlight] = useState<Box | null>(null);

  /*
   * The path is a ref, not state.
   *
   * It grows on every click and nothing on screen draws it -- it is only read
   * when a message is sent. Keeping it in state would re-render the panel, and
   * the whole conversation with it, every time the reviewer pressed a button
   * inside the prototype.
   */
  const steps = useRef<PathStep[]>([]);

  /*
   * The watcher is bound once and never rebound, so it cannot close over
   * `picking` -- it would capture whatever the value was at mount. This ref is
   * how the callback asks the current answer.
   */
  const pickingRef = useRef(false);
  useEffect(() => {
    pickingRef.current = picking;
  }, [picking]);

  // --- Watching the frame --------------------------------------------------

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    return watchPrototype(frame, {
      onScreen: setScreen,
      onStep: (step) => {
        // A click made while picking is the reviewer choosing something to
        // point at, not a step through the prototype -- the overlay swallowed
        // it, so nothing in the prototype happened.
        if (step.kind === "click" && pickingRef.current) return;
        steps.current = [...steps.current, step].slice(-60);
      },
    });
  }, []);

  // Escape cancels, which is the only way out that does not involve finding a
  // small button while the cursor is a crosshair.
  useEffect(() => {
    if (!picking) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicking(false);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [picking]);

  // --- Pointing at something ----------------------------------------------

  /**
   * What is under the pointer, and where it sits on our page.
   *
   * The overlay is a transparent sheet over the iframe in *our* document, so
   * the prototype never receives the mouse at all -- no click of the reviewer's
   * can navigate it, submit a form or open a dialog while they are choosing
   * what to point at. In exchange we have to do the hit testing ourselves,
   * which `elementFromPoint` does in one call.
   */
  const resolve = useCallback((clientX: number, clientY: number) => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !stage || !doc) return null;

    const frameBox = frame.getBoundingClientRect();
    const element = doc.elementFromPoint(
      clientX - frameBox.left,
      clientY - frameBox.top,
    );
    if (!element) return null;

    const stageBox = stage.getBoundingClientRect();
    const box = element.getBoundingClientRect();

    return {
      element,
      box: {
        left: frameBox.left - stageBox.left + box.left,
        top: frameBox.top - stageBox.top + box.top,
        width: box.width,
        height: box.height,
      },
    };
  }, []);

  const take = useCallback(
    async (element: Element) => {
      setPicking(false);
      setHighlight(null);
      setCapturing(true);
      setProblem(null);

      try {
        const shot = await captureElement(element);

        const body = new FormData();
        body.set("prototypeId", prototypeId);
        body.set("label", describeElement(element));
        body.set("selector", cssPath(element));
        body.set("rect", JSON.stringify(shot.rect));
        if (screen) body.set("screenId", screen);
        body.set("image", shot.blob, "shot.png");

        const response = await fetch("/api/annotation", { method: "POST", body });
        if (!response.ok) {
          const said = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(said?.error ?? "The picture could not be saved.");
        }

        const { annotation } = (await response.json()) as {
          annotation: AnnotationRef;
        };
        setReference(annotation);
      } catch (error) {
        // Never fatal. A review where the screenshot failed is still a review,
        // so say what happened and leave everything else working.
        setProblem(
          error instanceof Error
            ? error.message
            : "That could not be captured. Describing it still works.",
        );
      } finally {
        setCapturing(false);
      }
    },
    [prototypeId, screen],
  );

  const eyes: Eyes = {
    screen,
    reference,
    picking,
    capturing,
    problem,
    startPicking: () => {
      setProblem(null);
      setPicking(true);
    },
    cancelPicking: () => {
      setPicking(false);
      setHighlight(null);
    },
    clearReference: () => setReference(null),
    useReference: () => setReference(null),
    context: () => ({
      screen,
      path: describePath(steps.current, screen),
      reference,
    }),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div ref={stageRef} className="relative min-h-0 flex-1 max-lg:h-[65dvh]">
        <iframe
          ref={frameRef}
          src={`/p/${versionId}`}
          title={frameTitle}
          className="h-full w-full border-0 bg-white"
        />

        {picking ? (
          <>
            {/*
              The sheet that takes the mouse. Faintly tinted so it is obvious
              the prototype is not going to respond to a click right now --
              a crosshair cursor alone is too easy to miss.
            */}
            <div
              className="absolute inset-0 z-20 cursor-crosshair bg-primary/5"
              onMouseMove={(event) => {
                const found = resolve(event.clientX, event.clientY);
                setHighlight(found?.box ?? null);
              }}
              onMouseLeave={() => setHighlight(null)}
              onClick={(event) => {
                const found = resolve(event.clientX, event.clientY);
                if (found) void take(found.element);
              }}
            />

            {highlight ? (
              <div
                className="pointer-events-none absolute z-30 rounded-xs border-2 border-error bg-error/10"
                style={{
                  left: highlight.left,
                  top: highlight.top,
                  width: highlight.width,
                  height: highlight.height,
                }}
              />
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3">
              <p className="pointer-events-auto flex items-center gap-3 rounded-full bg-inverse-surface px-4 py-2 text-label-large text-inverse-on-surface shadow-level3">
                Click anything to point at it
                <button
                  type="button"
                  onClick={() => {
                    setPicking(false);
                    setHighlight(null);
                  }}
                  className="m3-state-layer -mr-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-inverse-primary"
                >
                  <CloseIcon className="size-4" />
                  Cancel
                </button>
              </p>
            </div>
          </>
        ) : null}

        {capturing ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3">
            <p className="rounded-full bg-inverse-surface px-4 py-2 text-label-large text-inverse-on-surface shadow-level3">
              Taking the picture…
            </p>
          </div>
        ) : null}
      </div>

      {assistantOff ? (
        <FeedbackPanel
          prototypeId={prototypeId}
          scenario={scenario}
          tasks={tasks}
          criteria={criteria}
          notBuilt={notBuilt}
          initialItems={items}
          initiallyCompleted={completed}
          eyes={eyes}
        />
      ) : (
        <AssistantPanel
          prototypeId={prototypeId}
          initialTimeline={timeline}
          initiallyCompleted={completed}
          configured={configured}
          hasTasks={tasks.length > 0}
          hasCriteria={criteria.length > 0}
          eyes={eyes}
        />
      )}
    </div>
  );
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The path, plus the one thing the raw list does not say out loud.
 *
 * Coming back to the same screen for a third time is the "backtracking" signal
 * in prompts/assistant.md, and it is the sort of thing that is obvious in a
 * list of eight steps and invisible in a list of sixty. Counting it here means
 * the assistant is told rather than expected to notice.
 */
function describePath(steps: PathStep[], screen: string | null): string {
  const digest = pathDigest(steps);
  if (!digest) return "";

  const visits = screen ? visitCount(steps, screen) : 0;
  if (visits < 3) return digest;

  return `${digest}\n\nThey have come back to ${screen} ${visits} times.`;
}
