/**
 * The tool that lets the assistant record feedback.
 *
 * This is the mechanism behind the one thing chunk 5 is for: a reviewer should
 * never have to stop reviewing, decide "this bit is feedback", and copy it into
 * a form. They describe what they found, in the same sentence they would say it
 * out loud, and it lands in the database.
 *
 * The schema below is not just a data shape -- it is instructions. Claude reads
 * every description in it, so the wording of each field is doing as much work
 * as prompts/assistant.md. Keep them concrete.
 */

import type Anthropic from "@anthropic-ai/sdk";

import { SEVERITIES, SEVERITY_DESCRIPTIONS } from "@/lib/feedback";

export const RECORD_FEEDBACK = "record_feedback";

/**
 * Severity descriptions, rendered into the shape the tool schema wants.
 *
 * Built from the same constants the reviewer's severity picker uses, so the
 * definition Claude works from and the definition the reviewer sees when they
 * correct it are guaranteed to be the same words.
 */
const severityGuidance = SEVERITIES.map(
  (s) => `"${s}": ${SEVERITY_DESCRIPTIONS[s]}`,
).join(" ");

export const recordFeedbackTool: Anthropic.Tool = {
  name: RECORD_FEEDBACK,
  description: [
    "Record one piece of feedback from the reviewer.",
    "",
    "Call this as soon as the reviewer describes something that is wrong,",
    "missing, confusing, or that they would want changed -- including when they",
    "say it in passing while asking about something else. Do not wait to be",
    "asked to log it, and do not ask permission first. The reviewer can see and",
    "delete anything you record, so recording something they did not mean is",
    "cheap and missing something they did mean is not.",
    "",
    "Call it once per distinct point. If they raise three problems in one",
    "message, call it three times.",
    "",
    "Do NOT call it when the reviewer is only asking a question, when they are",
    "saying something works, or to record a point you have already recorded in",
    "this conversation.",
    "",
    "If you are missing the detail for a field, leave it out and record what you",
    "do have rather than interrogating the reviewer first. You can ask a",
    "follow-up afterwards and record a second, fuller item if it turns out to",
    "matter.",
  ].join("\n"),
  input_schema: {
    type: "object",
    properties: {
      happened: {
        type: "string",
        description:
          "What the reviewer says actually happens, in their own words as far as possible. This is the most important field.",
      },
      expected: {
        type: "string",
        description:
          "What the reviewer expected to happen instead. Omit if they did not say.",
      },
      note: {
        type: "string",
        description:
          "Anything else worth keeping: why it matters, who it affects, a suggestion they made. Omit if there is nothing to add.",
      },
      screen_id: {
        type: "string",
        description:
          "Which screen or part of the prototype this is about, as the reviewer named it. Omit if they did not say -- do not guess.",
      },
      severity: {
        type: "string",
        enum: [...SEVERITIES],
        description: `How serious this is. ${severityGuidance} Judge it from what the reviewer said rather than how strongly they said it. When genuinely unsure, use "minor" -- the reviewer can raise it.`,
      },
    },
    required: ["happened"],
  },
};
