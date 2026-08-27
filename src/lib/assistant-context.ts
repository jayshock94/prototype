/**
 * Building the assistant's system prompt.
 *
 * Two parts, as CLAUDE.md describes:
 *
 *   1. prompts/assistant.md -- the global instructions, identical for every
 *      prototype. Edited by hand; this is the file that decides whether the
 *      assistant is any use.
 *   2. Per-prototype context appended underneath: what this prototype is, its
 *      knowledge base, and anything recorded as deliberately not built.
 *
 * Order matters for prompt caching: the global file is byte-identical across
 * every prototype and every reviewer, so it sits first and stays cacheable.
 * The per-prototype part changes per prototype but not per message, so it is
 * stable within a conversation too.
 */

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { MODE_DESCRIPTIONS, type AssistantMode } from "@/lib/briefing";

/**
 * Read once per server instance rather than per message.
 *
 * The file only changes on deploy, and a deploy starts a new instance. If you
 * edit prompts/assistant.md you must redeploy for it to take effect -- that is
 * the trade for not reading from disk on every keystroke.
 *
 * next.config.ts has an outputFileTracingIncludes entry for prompts/, without
 * which this file would not be bundled into the deployed function and this
 * read would fail in production while working perfectly in development.
 */
let cachedGlobalPrompt: string | null = null;

async function globalPrompt(): Promise<string> {
  if (cachedGlobalPrompt === null) {
    cachedGlobalPrompt = await readFile(
      path.join(process.cwd(), "prompts", "assistant.md"),
      "utf8",
    );
  }
  return cachedGlobalPrompt;
}

/** One feedback row already recorded this visit, as the prompt describes it. */
export interface RecordedFeedback {
  severity: string;
  screenId: string | null;
  happened: string | null;
  expected: string | null;
  note: string | null;
}

/** One thing the reviewer may be asked to try. */
export interface ContextTask {
  goal: string;
  successState: string | null;
}

/** One thing the ticket promised. */
export interface ContextCriterion {
  ref: string | null;
  text: string;
  verifiableInPrototype: boolean;
}

export interface PrototypeContext {
  name: string;
  description: string | null;
  versionLabel: string;
  knowledgeBaseText: string | null;
  notBuilt: string[];
  /** How hard to push. See prompts/assistant.md for what each one means. */
  mode: AssistantMode;
  /** The situation to set up in the opening, when there is one. */
  scenario: string | null;
  tasks: ContextTask[];
  criteria: ContextCriterion[];
  /**
   * Everything logged so far in this reviewer's session.
   *
   * Deliberately not part of the message history. The transcript says what was
   * *said*; this says what was *kept*, and the two drift apart the moment the
   * reviewer deletes an item. Feeding the live list stops the assistant
   * logging the same complaint twice when a reviewer circles back to it, and
   * lets it answer "what have I flagged so far?" accurately.
   */
  recorded: RecordedFeedback[];
}

/** Assemble the full system prompt for one prototype. */
export async function buildSystemPrompt(context: PrototypeContext): Promise<string> {
  const parts = [await globalPrompt()];

  parts.push(
    [
      "# This prototype",
      "",
      `Name: ${context.name}`,
      `Version: ${context.versionLabel}`,
      context.description ? `Description: ${context.description}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // The mode, in the assistant's own vocabulary rather than as a bare word.
  // prompts/assistant.md describes all three; this says which one is live and
  // repeats the description so the two can never drift apart in the model's
  // reading of them.
  parts.push(
    [
      "# Mode",
      "",
      `This prototype is in ${context.mode.toUpperCase()} mode.`,
      "",
      MODE_DESCRIPTIONS[context.mode],
      "",
      "The reviewer's own intent overrides this. Someone who is clearly just",
      "looking around gets browse behaviour whatever the mode says.",
    ].join("\n"),
  );

  if (context.scenario?.trim()) {
    parts.push(
      [
        "# Scenario",
        "",
        "Set this up in your opening, in one line, in your own words. Do not",
        "read it out verbatim and do not repeat it later.",
        "",
        context.scenario.trim(),
      ].join("\n"),
    );
  }

  if (context.tasks.length > 0) {
    parts.push(
      [
        "# Tasks",
        "",
        "What the reviewer can be asked to try. Offer these once, as a list,",
        "when it fits -- never in your opening, because a task list as a",
        "greeting reads like homework. Never navigate for them: if they cannot",
        "find something, that is the finding.",
        "",
        ...context.tasks.map((task, index) => {
          const line = `${index + 1}. ${task.goal}`;
          return task.successState
            ? `${line}\n   Done when: ${task.successState}`
            : line;
        }),
      ].join("\n"),
    );
  }

  if (context.criteria.length > 0) {
    const checkable = context.criteria.filter((c) => c.verifiableInPrototype);
    const notCheckable = context.criteria.filter((c) => !c.verifiableInPrototype);

    parts.push(
      [
        "# Acceptance criteria",
        "",
        "What the ticket promised. A reviewer can give a verdict on each one.",
        "",
        ...checkable.map((c) => `- ${c.ref ? `${c.ref}: ` : ""}${c.text}`),
        ...(notCheckable.length > 0
          ? [
              "",
              "These cannot be checked by clicking a prototype -- they are about",
              "timing, real data, notifications or another system. Say so plainly",
              "if a reviewer tries; do not let them guess and do not record a",
              "verdict on one.",
              "",
              ...notCheckable.map((c) => `- ${c.ref ? `${c.ref}: ` : ""}${c.text}`),
            ]
          : []),
      ].join("\n"),
    );
  }

  if (context.knowledgeBaseText?.trim()) {
    parts.push(
      [
        "# Knowledge base",
        "",
        "Everything you know about how this prototype is supposed to behave.",
        "",
        context.knowledgeBaseText.trim(),
      ].join("\n"),
    );
  } else {
    parts.push(
      [
        "# Knowledge base",
        "",
        "None was provided for this prototype. You have nothing to go on beyond",
        "what the reviewer tells you, so be especially careful not to invent",
        "behaviour -- say that you do not know.",
      ].join("\n"),
    );
  }

  if (context.notBuilt.length > 0) {
    parts.push(
      [
        "# Deliberately not built",
        "",
        "These are out of scope for this prototype. If a reviewer asks about",
        "one, say it is not part of this prototype rather than describing how",
        "it works.",
        "",
        ...context.notBuilt.map((item) => `- ${item}`),
      ].join("\n"),
    );
  }

  parts.push(
    context.recorded.length > 0
      ? [
          "# Already recorded this session",
          "",
          "These are in the reviewer's list right now. Do not record any of them",
          "again, even if the reviewer mentions it a second time -- say it is",
          "already logged. If they add detail to one, say you have noted it and",
          "record a new item only if it is genuinely a different point.",
          "",
          ...context.recorded.map((item) => {
            const where = item.screenId ? ` (${item.screenId})` : "";
            const body = [item.happened, item.expected, item.note]
              .filter(Boolean)
              .join(" / ");
            return `- [${item.severity}]${where} ${body}`;
          }),
        ].join("\n")
      : [
          "# Already recorded this session",
          "",
          "Nothing yet.",
        ].join("\n"),
  );

  return parts.join("\n\n---\n\n");
}
