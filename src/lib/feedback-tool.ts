/**
 * The tool that lets the assistant propose feedback.
 *
 * A reviewer should never have to stop reviewing, decide "this bit is
 * feedback", and copy it into a form. They describe what they found, in the
 * same sentence they would say it out loud, and a draft appears under it.
 *
 * It is a *proposal*, not a write. prompts/assistant.md is explicit that
 * nothing is saved without the reviewer saying so: a bot that logs things
 * people did not mean to say is worse than one that logs nothing, because Jay
 * reads these and acts on them. So the tool returns a card, and the Save button
 * on that card is what actually writes a row.
 *
 * The schema below is not just a data shape -- it is instructions. Claude reads
 * every description in it, so the wording of each field is doing as much work
 * as prompts/assistant.md. Keep them concrete.
 */

import type Anthropic from "@anthropic-ai/sdk";

import { SEVERITIES, SEVERITY_DESCRIPTIONS } from "@/lib/feedback";

export const PROPOSE_FEEDBACK = "propose_feedback";

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

export const proposeFeedbackTool: Anthropic.Tool = {
  name: PROPOSE_FEEDBACK,
  description: [
    "Propose one piece of feedback from the reviewer.",
    "",
    "This does NOT save anything. It puts a draft card in front of the",
    "reviewer, and they save it, change how serious it is, or throw it away.",
    "Nothing reaches Jay until they have said so.",
    "",
    "Call it as soon as the reviewer describes something that is wrong,",
    "missing, confusing, or that they would want changed -- including when they",
    "say it in passing while asking about something else. Do not ask permission",
    "first and do not ask \"shall I log that?\": propose it and carry on talking.",
    "The card is the question.",
    "",
    "Call it once per distinct point. If they raise three problems in one",
    "message, call it three times.",
    "",
    "Write it in the reviewer\'s words, not yours. They are about to read it",
    "back and decide whether it is what they meant, so a tidied-up version of",
    "what they said is harder to recognise than the thing they actually said.",
    "",
    "Do NOT call it when the reviewer is only asking a question, when they are",
    "saying something works, or to propose a point you have already proposed or",
    "that is already in the recorded list.",
    "",
    "If you are missing the detail for a field, leave it out and propose what",
    "you do have rather than interrogating the reviewer first.",
  ].join("\n"),
  input_schema: {
    type: "object",
    properties: {
      happened: {
        type: "string",
        description:
          "What the reviewer says actually happens, in their own words as far as possible.",
      },
      expected: {
        type: "string",
        description:
          "What the reviewer expected to happen instead. This is the single most valuable thing in a review -- the gap between what someone expected and what they got is what Jay is reading for. If they have not said it and it is not obvious, ask before you propose.",
      },
      note: {
        type: "string",
        description:
          "Anything else worth keeping: why it matters, who it affects, a suggestion they made. Omit if there is nothing to add.",
      },
      screen_id: {
        type: "string",
        description:
          "Which screen this is about. Omit it and the screen the reviewer is actually on is filled in, which is right almost every time -- only set it when the point is about a different screen from the one in front of them, and then use the name from the context above rather than inventing one.",
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
